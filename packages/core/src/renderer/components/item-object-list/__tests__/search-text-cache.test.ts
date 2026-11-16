/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it, vi } from "vitest";
import { createSearchMatcher } from "../search-matcher";
import { canSearchByText, filterBySearchText } from "../search-text-cache";

import type { ItemObject } from "@freelensapp/list-layout";

import type { ListLayoutSearchFilter } from "../list-layout";

interface Item extends ItemObject {
  texts: (string | number | null | undefined)[];
  more: unknown;
}

// The search the list ran before it kept the text of the items.
const uncached = (items: Item[], filters: ListLayoutSearchFilter<Item>[], search: string) => {
  const matchesSearch = createSearchMatcher(search);

  return items.filter((item) => filters.some((getTexts) => [getTexts(item)].flat().some(matchesSearch)));
};

const random = (seed: number) => {
  let state = seed;

  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;

    return state / 4294967296;
  };
};

const pieces = ["nginx", "ingress", "-", "_", "Team", "7", "x", "", "a", "-v2", "pod-1a2b", "UPPER", "é", "İ"];

describe("filterBySearchText", () => {
  it("finds the same items as matching every text, for queries with and without separators", () => {
    const next = random(11);
    const word = () =>
      Array.from({ length: 1 + Math.floor(next() * 4) }, () => pieces[Math.floor(next() * pieces.length)]).join("");
    const items: Item[] = Array.from({ length: 400 }, (_, index) => ({
      getId: () => `id${index}`,
      getName: () => `n${index}`,
      texts: Array.from({ length: Math.floor(next() * 4) }, () => (next() < 0.1 ? undefined : word())),
      more: next() < 0.2 ? [word(), 5] : word(),
    }));
    const filters: ListLayoutSearchFilter<Item>[] = [
      (item) => item.texts,
      (item) => item.more as string,
      (item) => item.getName(),
      (item) => (item.texts.length > 1 ? 42 : null),
    ];
    const queries = [
      "nginx",
      "nginxingress",
      "nginx-ingress",
      "nginx_ingress",
      "team7",
      "team-7",
      "_",
      "-",
      "x_y",
      "a",
      "UPPER",
      "undefined",
      "null",
      "42",
      "é",
      "İ",
      "v2",
      "-v2",
      ...Array.from({ length: 60 }, word),
    ];

    for (const query of queries) {
      expect(filterBySearchText(items, filters, query)).toStrictEqual(uncached(items, filters, query));
    }

    // Back and forth between the kinds of query, on warm caches.
    for (const query of ["nginx-ingress", "nginxingress", "nginx-ingress", "a", "-"]) {
      expect(filterBySearchText(items, filters, query)).toStrictEqual(uncached(items, filters, query));
    }
  });

  it("reads the texts of an item once for queries of one kind, and again for a replaced item", () => {
    const getTexts = vi.fn((item: Item) => item.texts);
    const filters = [getTexts];
    const first: Item = { getId: () => "1", getName: () => "1", texts: ["alpha"], more: "" };
    const second: Item = { getId: () => "2", getName: () => "2", texts: ["beta"], more: "" };

    expect(filterBySearchText([first, second], filters, "alp")).toEqual([first]);
    expect(filterBySearchText([first, second], filters, "bet")).toEqual([second]);
    expect(getTexts).toHaveBeenCalledTimes(2);

    const replaced: Item = { ...first, texts: ["gamma"] };

    expect(filterBySearchText([replaced, second], filters, "alp")).toEqual([]);
    expect(filterBySearchText([replaced, second], filters, "gam")).toEqual([replaced]);
    expect(getTexts).toHaveBeenCalledTimes(3);
  });

  it("keeps the text of different filter arrays apart", () => {
    const item: Item = { getId: () => "1", getName: () => "1", texts: ["alpha"], more: "beta" };

    expect(filterBySearchText([item], [(i) => i.texts], "beta")).toEqual([]);
    expect(filterBySearchText([item], [(i) => i.more as string], "beta")).toEqual([item]);
  });

  it("leaves a query with a NUL to the search of every text", () => {
    expect(canSearchByText("a\0b")).toBe(false);
    expect(canSearchByText("ab")).toBe(true);
  });
});
