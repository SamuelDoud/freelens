/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { rectifyOrdering } from "@freelensapp/utilities";
import { describe, expect, it } from "vitest";
import { compareSortValues } from "../../item.store";
import { ItemOrder } from "../item-order";

interface Row {
  id: number;
  name: unknown;
  rank: unknown;
}

// One type of key at a time, plus the values that sort apart from it: keys of
// mixed types have no consistent order, in ItemStore.sortItems or here.
const strings: unknown[] = ["a", "b", "ab", "B", "", "10", "9", null, undefined];
const numbers: unknown[] = [1, 2, 10, 0, -1, 2.5, NaN, null, undefined];

// The order of ItemStore.sortItems, which a flush must reproduce: a stable sort by every key in turn,
// each in the given direction.
const sortItems = (list: Row[], by: ((row: Row) => unknown)[], order: "asc" | "desc" | undefined): Row[] =>
  [...list].sort((left, right) => {
    for (const sortBy of by) {
      const ordering = rectifyOrdering(compareSortValues(sortBy(left), sortBy(right)), order ?? "asc");

      if (ordering) return ordering;
    }

    return 0;
  });

// A small deterministic generator, so that a failure can be reproduced.
const random = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;

  return seed / 4294967296;
};

const rows = (count: number, next: () => number, pool: unknown[]): Row[] =>
  Array.from({ length: count }, (_, id) => ({
    id,
    name: pool[Math.floor(next() * pool.length)],
    rank: pool[Math.floor(next() * pool.length)],
  }));

const ids = (list: Row[]) => list.map((row) => row.id);

describe("ItemOrder", () => {
  const variants: [string, ((row: Row) => unknown)[], "asc" | "desc" | undefined][] = [
    ["one key", [(row) => row.name], undefined],
    ["one key, descending", [(row) => row.name], "desc"],
    ["two keys", [(row) => row.name, (row) => row.rank], undefined],
    ["two keys, descending", [(row) => row.name, (row) => row.rank], "desc"],
    ["two keys, ascending stated", [(row) => row.name, (row) => row.rank], "asc"],
  ];

  describe.each(variants)("%s", (_, by, order) => {
    const order_ = new ItemOrder<Row>(by, order);

    it("sorts as ItemStore.sortItems does, ties included", () => {
      for (let seed = 1; seed <= 60; seed++) {
        const next = random(seed);
        const pool = [["a", "b", "c", "d"], strings, numbers][seed % 3];
        const list = rows(1 + Math.floor(next() * 80), next, pool);

        expect(ids(order_.sort(list))).toEqual(ids(sortItems(list, by.length ? by : [(row) => row], order)));
      }
    });

    it("merges as sorting everything does", () => {
      for (let seed = 1; seed <= 60; seed++) {
        const next = random(seed + 1000);
        const pool = [["a", "b", "c", "d"], strings, numbers][seed % 3];
        const base = order_.sort(rows(Math.floor(next() * 80), next, pool));
        const added = rows(Math.floor(next() * 20), next, pool).map((row) => ({ ...row, id: row.id + 1000 }));

        expect(order_.isSorted(base)).toBe(true);
        expect(ids(order_.merge(base, added))).toEqual(ids(order_.sort([...base, ...added])));
      }
    });
  });

  it("merges items that moved by the position they had", () => {
    const order = new ItemOrder<Row>([(row) => row.name]);

    for (let seed = 1; seed <= 100; seed++) {
      const next = random(seed + 5000);
      const base = order.sort(rows(2 + Math.floor(next() * 60), next, ["a", "b", "c"]));
      // Some items change their key in place, the way a modified object does.
      const moved = new Set(base.map((_, index) => index).filter(() => next() < 0.2));
      const changed = base.map((row, index) =>
        moved.has(index) ? { ...row, name: ["a", "b", "c"][Math.floor(next() * 3)] } : row,
      );
      const stay = changed.filter((_, index) => !moved.has(index));
      const ranks = changed.map((_, index) => index).filter((index) => !moved.has(index));

      const merged = order.mergeRanked(
        stay,
        ranks,
        [...moved].map((index) => ({ item: changed[index], rank: index })),
      );

      expect(ids(merged)).toEqual(ids(order.sort(changed)));
    }
  });

  it("finds an unsorted list", () => {
    const order = new ItemOrder<Row>([(row) => row.name]);

    expect(
      order.isSorted([
        { id: 1, name: "b", rank: 0 },
        { id: 2, name: "a", rank: 0 },
      ]),
    ).toBe(false);
  });
});
