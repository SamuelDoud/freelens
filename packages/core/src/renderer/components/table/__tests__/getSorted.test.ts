/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Ordering, rectifyOrdering, sortCompare, tuple } from "@freelensapp/utilities";
import { cloneDeep } from "es-toolkit";
import { describe, expect, it } from "vitest";
import { getSorted } from "../sorting";

import type { TableOrderBy } from "../table";

// The comparator getSorted had before its keys were normalised once per item.
function getSortedReference<T>(
  rawItems: T[],
  sortingCallback: (item: T) => unknown,
  orderBy: TableOrderBy = "asc",
): T[] {
  const sortData = rawItems.map((item, index) => ({ index, sortBy: sortingCallback(item) as any }));

  sortData.sort((left, right) => {
    if (!Array.isArray(left.sortBy) && !Array.isArray(right.sortBy)) {
      return rectifyOrdering(sortCompare(left.sortBy, right.sortBy), orderBy);
    }

    const zipIter = tuple.zip([left.sortBy].flat(), [right.sortBy].flat());
    let r = zipIter.next();

    for (; !r.done; r = zipIter.next()) {
      const [nextL, nextR] = r.value;
      const sortOrder = rectifyOrdering(sortCompare(nextL, nextR), orderBy);

      if (sortOrder !== Ordering.EQUAL) {
        return sortOrder;
      }
    }

    const [leftRest, rightRest] = r.value;

    return leftRest.length - rightRest.length;
  });

  return sortData.map(({ index }) => rawItems[index]);
}

// A small deterministic generator, so a failure reproduces.
function random(seed: number) {
  let state = seed;

  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;

    return state / 4294967296;
  };
}

describe("Table tests", () => {
  describe("getSorted", () => {
    it.each([undefined, 5, "", true, {}, []])("should not sort since %j is not a function", () => {
      expect(getSorted([1, 2, 4, 3], undefined, "asc")).toStrictEqual([1, 2, 4, 3]);
    });

    it("should sort numerically asc and not touch the original list", () => {
      const i = [1, 2, 4, 3];

      expect(getSorted(i, (v) => v, "asc")).toStrictEqual([1, 2, 3, 4]);
      expect(i).toStrictEqual([1, 2, 4, 3]);
    });

    it("should sort numerically desc and not touch the original list", () => {
      const i = [1, 2, 4, 3];

      expect(getSorted(i, (v) => v, "desc")).toStrictEqual([4, 3, 2, 1]);
      expect(i).toStrictEqual([1, 2, 4, 3]);
    });

    it("should sort numerically asc (by default) and not touch the original list", () => {
      const i = [1, 2, 4, 3];

      expect(getSorted(i, (v) => v)).toStrictEqual([1, 2, 3, 4]);
      expect(i).toStrictEqual([1, 2, 4, 3]);
    });

    describe("multi-part", () => {
      it("should sort each part by its order", () => {
        const i = ["a", "c", "b.1", "b.2", "d"];

        expect(getSorted(i, (v) => v.split("."), "desc")).toStrictEqual(["d", "c", "b.2", "b.1", "a"]);
        expect(i).toStrictEqual(["a", "c", "b.1", "b.2", "d"]);
      });

      it("should be a stable sort", () => {
        const i = [
          {
            val: "a",
            k: 1,
          },
          {
            val: "c",
            k: 2,
          },
          {
            val: "b.1",
            k: 3,
          },
          {
            val: "b.2",
            k: 4,
          },
          {
            val: "d",
            k: 5,
          },
          {
            val: "b.2",
            k: -10,
          },
        ];
        const dup = cloneDeep(i);
        const expected = [
          {
            val: "a",
            k: 1,
          },
          {
            val: "b.1",
            k: 3,
          },
          {
            val: "b.2",
            k: 4,
          },
          {
            val: "b.2",
            k: -10,
          },
          {
            val: "c",
            k: 2,
          },
          {
            val: "d",
            k: 5,
          },
        ];

        expect(getSorted(i, ({ val }) => val.split("."), "asc")).toStrictEqual(expected);
        expect(i).toStrictEqual(dup);
      });

      it("should be a stable sort #2", () => {
        const i = [
          {
            val: "a",
            k: 1,
          },
          {
            val: "b.2",
            k: -10,
          },
          {
            val: "c",
            k: 2,
          },
          {
            val: "b.1",
            k: 3,
          },
          {
            val: "b.2",
            k: 4,
          },
          {
            val: "d",
            k: 5,
          },
        ];
        const dup = cloneDeep(i);
        const expected = [
          {
            val: "a",
            k: 1,
          },
          {
            val: "b.1",
            k: 3,
          },
          {
            val: "b.2",
            k: -10,
          },
          {
            val: "b.2",
            k: 4,
          },
          {
            val: "c",
            k: 2,
          },
          {
            val: "d",
            k: 5,
          },
        ];

        expect(getSorted(i, ({ val }) => val.split("."), "asc")).toStrictEqual(expected);
        expect(i).toStrictEqual(dup);
      });
    });
  });

  describe("equivalence with the previous comparator", () => {
    const value = (next: () => number): string | number | undefined => {
      const pick = next();

      if (pick < 0.1) return undefined;
      if (pick < 0.15) return Number.NaN;
      if (pick < 0.2) return -0;
      if (pick < 0.6) return Math.floor(next() * 5);

      return "abcde"[Math.floor(next() * 5)];
    };

    it.each(["scalar", "arrays", "mixed"] as const)("orders %s keys like the old one, ties included", (shape) => {
      for (let seed = 1; seed <= 40; seed++) {
        const next = random(seed);
        const items = Array.from({ length: 5 + Math.floor(next() * 120) }, (_, id) => ({ id, key: next() }));
        const keyOf = (item: { id: number }): any => {
          const next = random(item.id * 7919 + seed);
          const asArray = shape === "arrays" || (shape === "mixed" && next() < 0.5);

          if (!asArray) return value(next);

          return Array.from({ length: Math.floor(next() * 4) }, () => value(next));
        };

        for (const direction of ["asc", "desc"] as const) {
          const expected = getSortedReference(items, keyOf, direction);
          const actual = getSorted(items, keyOf, direction);

          expect(actual.map((item) => item.id)).toStrictEqual(expected.map((item) => item.id));
        }
      }
    });

    it("keeps the shorter key first in both directions", () => {
      const items = [["a", 1], ["a"], ["a", 0]];

      expect(getSorted(items, (item) => item, "desc")).toStrictEqual(getSortedReference(items, (item) => item, "desc"));
    });

    it("drops the holes of a sparse key like flat() did", () => {
      const sparse = [1, , 3] as number[];
      const items = [sparse, [1, 3], [1, 2]];

      expect(getSorted(items, (item) => item)).toStrictEqual(getSortedReference(items, (item) => item));
    });
  });
});
