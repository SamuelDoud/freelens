/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { diffByIdentity, KeyedItemIndex } from "../keyed-item-index";

import type { ArraySegment } from "../keyed-item-index";

interface Thing {
  key: string;
  version: number;
}

const thing = (key: string, version = 0): Thing => ({ key, version });

// A small seeded generator, so that a failure reproduces.
const random = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;

  return seed / 2 ** 32;
};

const apply = <T>(prev: T[], next: T[], segments: ArraySegment[]) => {
  const rebuilt: T[] = [];
  let at = 0;

  for (const { prevFrom, prevTo, nextFrom, nextTo } of segments) {
    rebuilt.push(...prev.slice(at, prevFrom), ...next.slice(nextFrom, nextTo));
    at = prevTo;
  }

  return [...rebuilt, ...prev.slice(at)];
};

describe("diffByIdentity", () => {
  it("finds no segment between an array and a copy of it", () => {
    const items = [thing("a"), thing("b")];

    expect(diffByIdentity(items, [...items], 10)).toEqual([]);
  });

  it("describes replacements, insertions and removals", () => {
    const [a, b, c, d, e] = ["a", "b", "c", "d", "e"].map((key) => thing(key));
    const b2 = thing("b", 1);

    expect(diffByIdentity([a, b, c, d], [a, b2, c, d], 10)).toEqual([
      { prevFrom: 1, prevTo: 2, nextFrom: 1, nextTo: 2 },
    ]);
    expect(diffByIdentity([a, b, c], [a, b, e, c], 10)).toEqual([{ prevFrom: 2, prevTo: 2, nextFrom: 2, nextTo: 3 }]);
    expect(diffByIdentity([a, b, c, d], [a, d], 10)).toEqual([{ prevFrom: 1, prevTo: 3, nextFrom: 1, nextTo: 1 }]);
    expect(diffByIdentity([], [a], 10)).toEqual([{ prevFrom: 0, prevTo: 0, nextFrom: 0, nextTo: 1 }]);
    expect(diffByIdentity([a], [], 10)).toEqual([{ prevFrom: 0, prevTo: 1, nextFrom: 0, nextTo: 0 }]);
  });

  it("gives up on too many segments", () => {
    const prev = Array.from({ length: 10 }, (_, i) => thing(`k${i}`));
    const next = prev.map((item) => ({ ...item }));

    expect(diffByIdentity(prev, next, 3)).toBeUndefined();
  });

  it("always describes the difference it reports", () => {
    const next = random(7);

    for (let round = 0; round < 300; round++) {
      const pool = Array.from({ length: 40 }, (_, i) => thing(`k${i}`));
      const prev = pool.filter(() => next() < 0.7);
      const after = prev.slice();

      for (let edit = Math.floor(next() * 6); edit > 0; edit--) {
        const at = Math.floor(next() * (after.length + 1));
        const kind = next();

        if (kind < 0.4) after.splice(at, 1);
        else if (kind < 0.7) after.splice(at, 0, thing(`n${round}-${edit}`));
        else after.splice(at, 1, thing(`r${round}-${edit}`));
      }

      const segments = diffByIdentity(prev, after, 1000);

      if (segments) {
        expect(apply(prev, after, segments)).toEqual(after);
        expect(apply(prev, after, segments).every((item, i) => item === after[i])).toBe(true);
      }
    }
  });
});

describe("KeyedItemIndex", () => {
  const firstOf = (items: Thing[], key: string) => items.find((item) => item.key === key);

  const expectSame = (index: KeyedItemIndex<Thing>, items: Thing[], keys: string[]) => {
    for (const key of keys) {
      expect(index.get(key)?.item).toBe(firstOf(items, key));
    }
  };

  it("gives the first of items that share a key", () => {
    const index = new KeyedItemIndex<Thing>((item) => item.key);
    const first = thing("same", 1);
    const items = [first, thing("same", 2), thing("other")];

    index.sync(items);

    expect(index.get("same")?.item).toBe(first);
    expect(index.get("none")).toBeUndefined();
  });

  it("follows random sequences of arrays as a search would", () => {
    const next = random(42);

    for (let round = 0; round < 200; round++) {
      const index = new KeyedItemIndex<Thing>((item) => item.key);
      const keys = Array.from({ length: 30 }, (_, i) => `k${i}`);
      let items: Thing[] = keys.filter(() => next() < 0.6).map((key) => thing(key));

      for (let step = 0; step < 8; step++) {
        const duplicatesAllowed = round % 5 === 0;
        const after = items.slice();

        for (let edit = Math.floor(next() * 5); edit > 0; edit--) {
          const at = Math.floor(next() * (after.length + 1));
          const key = keys[Math.floor(next() * keys.length)];
          const kind = next();

          if (kind < 0.3) after.splice(at, 1);
          else if (kind < 0.6) after.splice(at, 1, thing(after[at]?.key ?? key, step));
          else if (duplicatesAllowed || !after.some((item) => item.key === key)) after.splice(at, 0, thing(key, step));
        }

        items = after;
        index.sync(items);

        expectSame(index, items, keys);
      }
    }
  });

  it("follows a batch of changes through a large array without reading the items that stayed", () => {
    let reads = 0;
    const index = new KeyedItemIndex<Thing>((item) => {
      reads++;

      return item.key;
    });
    const items = Array.from({ length: 5000 }, (_, i) => thing(`k${i}`));

    index.sync(items);
    expect(reads).toBe(5000);

    reads = 0;

    const after = items.slice();

    for (let at = 0; at < after.length; at += 100) {
      after[at] = thing(after[at].key, 1);
    }

    after.splice(2500, 0, thing("added"));
    after.splice(100, 1);
    index.sync(after);

    // 50 replaced, one added and one removed: two reads for each replaced item, one for the others.
    expect(reads).toBeLessThan(200);
    expectSame(index, after, ["k0", "k100", "k101", "k2500", "added", "k4900", "k4999"]);
  });

  it("is a rebuild after a duplicate, and incremental again once there are none", () => {
    const index = new KeyedItemIndex<Thing>((item) => item.key);
    const a = thing("a");
    const b = thing("b");
    const a2 = thing("a", 2);

    index.sync([a, b, a2]);
    expect(index.get("a")?.item).toBe(a);

    index.sync([b, a2]);
    expect(index.get("a")?.item).toBe(a2);

    index.sync([b, a2, thing("c")]);
    expect(index.get("c")).toBeDefined();
  });

  it("tells whether an array differs from the one it describes", () => {
    const index = new KeyedItemIndex<Thing>((item) => item.key);
    const items = [thing("a"), thing("b")];

    index.sync(items);

    expect(index.differsFrom([...items])).toBe(false);
    expect(index.differsFrom([items[0], thing("b")])).toBe(true);
    expect(index.differsFrom([items[0]])).toBe(true);
  });
});
