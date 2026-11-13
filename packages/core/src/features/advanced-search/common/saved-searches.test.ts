/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { readSavedSearches } from "./saved-searches";

const condition = { id: "c1", kind: "text", field: "name", operator: "startsWith", value: "api", negate: false };
const search = {
  id: "s1",
  name: "APIs",
  viewKey: "v1/Pod",
  viewTitle: "Pods",
  routePath: "/pods",
  conditions: [condition],
  createdAt: "2026-11-13T12:00:00.000Z",
};

describe("readSavedSearches", () => {
  it("reads well-formed saved searches as they are", () => {
    expect(readSavedSearches([search])).toEqual([search]);
  });

  it("reads anything but an array as no saved searches", () => {
    expect(readSavedSearches(undefined)).toEqual([]);
    expect(readSavedSearches({ s1: search })).toEqual([]);
  });

  it("drops malformed entries and conditions of an unknown kind or operator", () => {
    const read = readSavedSearches([
      search,
      { ...search, id: 3 },
      null,
      {
        ...search,
        id: "s2",
        conditions: [
          condition,
          { ...condition, id: "c2", operator: "fuzzy" },
          { ...condition, id: "c3", kind: "number" },
          { ...condition, id: "c4", kind: "time", operator: "olderThan", value: "2h", negate: "yes" },
        ],
      },
    ]);

    expect(read.map(({ id }) => id)).toEqual(["s1", "s2"]);
    expect(read[1].conditions).toEqual([
      condition,
      { id: "c4", kind: "time", field: "name", operator: "olderThan", value: "2h", negate: false },
    ]);
  });
});
