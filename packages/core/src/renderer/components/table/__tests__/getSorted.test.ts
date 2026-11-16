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

  describe("keys without a value", () => {
    const sorted = (keys: unknown[], direction: "asc" | "desc") =>
      getSorted(
        keys.map((key, id) => ({ id, key })),
        ({ key }) => key as any,
        direction,
      ).map(({ id }) => id);

    it.each(["asc", "desc"] as const)("puts undefined and NaN last, in input order, sorting %s", (direction) => {
      const keys = [undefined, 2, Number.NaN, 1, undefined, 3];
      const present = direction === "asc" ? [3, 1, 5] : [5, 1, 3];

      expect(sorted(keys, direction)).toStrictEqual([...present, 0, 2, 4]);
    });

    it("puts a part without a value last in a multi-part key", () => {
      const items = [
        ["a", undefined],
        ["a", 1],
        ["a", Number.NaN],
        ["a", 0],
      ];

      expect(getSorted(items, (item) => item as any, "desc")).toStrictEqual([
        ["a", 1],
        ["a", 0],
        ["a", undefined],
        ["a", Number.NaN],
      ]);
    });
  });

  describe("equivalence with the previous comparator", () => {
    const value = (next: () => number): string | number | undefined => {
      const pick = next();

      // undefined and NaN have no consistent order in the old comparator; they are tested below.
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
    describe("number keys of a long list", () => {
      const specials = [
        0,
        -0,
        Number.NaN,
        undefined,
        null,
        Infinity,
        -Infinity,
        5e-324,
        -5e-324,
        1e300,
        -1e300,
        2 ** 53,
      ];

      // The stable comparator sort, a key without a value after every other one in both directions.
      const stableReference = (items: { id: number }[], keyOf: (item: { id: number }) => any, direction: string) => {
        const sign = direction === "desc" ? -1 : 1;
        const missing = (key: unknown) => key === undefined || key === null || Number.isNaN(key);

        return items
          .map((item, index) => ({ index, key: keyOf(item) }))
          .sort((left, right) => {
            if (missing(left.key) || missing(right.key)) {
              return missing(left.key) === missing(right.key) ? 0 : missing(left.key) ? 1 : -1;
            }

            return sign * (left.key < right.key ? -1 : left.key === right.key ? 0 : 1);
          })
          .map(({ index }) => items[index].id);
      };

      it.each(["asc", "desc"] as const)(
        "orders like the stable comparator sort, ties and missing values included (%s)",
        (direction) => {
          for (let seed = 1; seed <= 25; seed++) {
            const next = random(seed);
            const items = Array.from({ length: 300 + Math.floor(next() * 3000) }, (_, id) => ({ id }));
            const keyOf = (item: { id: number }): any => {
              const next = random(item.id * 104729 + seed);
              const pick = next();

              if (pick < 0.25) return specials[Math.floor(next() * specials.length)];
              if (pick < 0.6) return Math.floor(next() * 20) - 10;

              return (next() - 0.5) * 1e6;
            };

            expect(getSorted(items, keyOf, direction).map((item) => item.id)).toStrictEqual(
              stableReference(items, keyOf, direction),
            );
          }
        },
      );

      it("falls back to the comparator for a mix of numbers and strings", () => {
        const items = Array.from({ length: 400 }, (_, id) => ({ id }));
        const keyOf = (item: { id: number }): any => (item.id % 7 === 0 ? "a" : (item.id * 31) % 13);

        expect(getSorted(items, keyOf).map((item) => item.id)).toStrictEqual(stableReference(items, keyOf, "asc"));
      });
    });

    describe("starting from a previous result", () => {
      type Row = { id: number; key: unknown };

      // Rows with many ties, so that the order of equal keys is exercised.
      const makeRows = (next: () => number, count: number, shape: "numbers" | "strings" | "arrays" | "mixed"): Row[] =>
        Array.from({ length: count }, (_, id) => {
          const n = Math.floor(next() * 40);
          const key =
            shape === "numbers"
              ? next() < 0.05
                ? undefined
                : n
              : shape === "strings"
                ? `k${n}`
                : shape === "arrays"
                  ? [n % 7, `s${n}`]
                  : next() < 0.5
                    ? n
                    : `k${n}`;

          return { id, key };
        });

      it.each(["numbers", "strings", "arrays", "mixed"] as const)(
        "gives the order of a sort from scratch after a flush, %s keys",
        (shape) => {
          for (let seed = 1; seed <= 12; seed++) {
            const next = random(seed);
            let rows = makeRows(next, 600 + Math.floor(next() * 400), shape);

            for (const direction of ["asc", "desc"] as const) {
              let previous = getSorted(rows, (row) => row.key as any, direction);

              for (let flush = 0; flush < 6; flush++) {
                // A flush replaces some rows by new objects, appends some and removes some, in the store's order.
                const replaced = rows.map((row) =>
                  next() < 0.02 ? { id: row.id, key: next() < 0.5 ? row.key : makeRows(next, 1, shape)[0].key } : row,
                );
                const added = makeRows(next, Math.floor(next() * 10), shape).map((row, i) => ({
                  ...row,
                  id: 10000 + flush * 100 + i,
                }));
                const kept = replaced.filter(() => next() > 0.01);

                rows = next() < 0.5 ? [...kept, ...added] : [...added, ...kept];

                const expected = getSorted(rows, (row) => row.key as any, direction);
                const actual = getSorted(rows, (row) => row.key as any, direction, previous);

                expect(actual.map((row) => row.id)).toStrictEqual(expected.map((row) => row.id));
                previous = actual;
              }
            }
          }
        },
      );

      it("falls back to the full sort when the keys of the previous items changed", () => {
        const next = random(7);
        const rows = makeRows(next, 1000, "numbers") as { id: number; key: number }[];
        const previous = getSorted(rows, (row) => row.key);
        const changed = rows.map((row) => row.key);
        const flipped = (row: { id: number }) => -changed[row.id] || 0;

        expect(getSorted(rows, flipped, "asc", previous).map((row) => row.id)).toStrictEqual(
          getSorted(rows, flipped, "asc").map((row) => row.id),
        );
      });

      it("handles the same item twice and a previous list with strangers", () => {
        const next = random(3);
        const rows = makeRows(next, 800, "numbers");
        const previous = getSorted(rows, (row) => row.key as number);
        const twice = [...rows, rows[5], rows[6]];

        expect(getSorted(twice, (row) => row.key as number, "asc", previous)).toStrictEqual(
          getSorted(twice, (row) => row.key as number, "asc"),
        );
        expect(getSorted(rows.slice(300), (row) => row.key as number, "asc", previous)).toStrictEqual(
          getSorted(rows.slice(300), (row) => row.key as number),
        );
      });
    });
  });
});
