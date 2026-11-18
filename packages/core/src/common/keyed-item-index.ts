/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * A stretch where two arrays differ: `prev[prevFrom, prevTo)` is what became
 * `next[nextFrom, nextTo)`. Either side can be empty. Outside the segments,
 * the arrays hold the same objects in the same order.
 */
export interface ArraySegment {
  readonly prevFrom: number;
  readonly prevTo: number;
  readonly nextFrom: number;
  readonly nextTo: number;
}

/**
 * How far past a mismatch the diff looks for the two arrays to meet again,
 * counting the items skipped on both sides together.
 */
const resyncReach = 16;

/**
 * Where `next` differs from `prev`, found by comparing the objects themselves
 * and never reading them: a replaced, added or removed item costs a few
 * comparisons, and an item that stayed costs one. The segments are a valid
 * edit script, though not always the shortest.
 *
 * Gives up, returning undefined, when there are more than `maxSegments`
 * segments, or when the arrays do not meet again within a short reach of a
 * mismatch (an item that moved far, a large batch of insertions).
 */
export function diffByIdentity<T>(
  prev: readonly T[],
  next: readonly T[],
  maxSegments: number,
): ArraySegment[] | undefined {
  const segments: ArraySegment[] = [];
  const prevLength = prev.length;
  const nextLength = next.length;
  let i = 0;
  let j = 0;

  for (;;) {
    while (i < prevLength && j < nextLength && prev[i] === next[j]) {
      i += 1;
      j += 1;
    }

    if (i === prevLength && j === nextLength) {
      return segments;
    }

    if (segments.length >= maxSegments) {
      return undefined;
    }

    if (i === prevLength || j === nextLength) {
      segments.push({ prevFrom: i, prevTo: prevLength, nextFrom: j, nextTo: nextLength });

      return segments;
    }

    let met = false;

    for (let reach = 1; reach <= resyncReach && !met; reach += 1) {
      for (let skippedPrev = 0; skippedPrev <= reach; skippedPrev += 1) {
        const prevAt = i + skippedPrev;
        const nextAt = j + reach - skippedPrev;

        if (prevAt > prevLength || nextAt > nextLength) continue;

        const atEnd = prevAt === prevLength && nextAt === nextLength;

        if (atEnd || (prevAt < prevLength && nextAt < nextLength && prev[prevAt] === next[nextAt])) {
          segments.push({ prevFrom: i, prevTo: prevAt, nextFrom: j, nextTo: nextAt });
          i = prevAt;
          j = nextAt;
          met = true;
          break;
        }
      }
    }

    if (!met) {
      return undefined;
    }
  }
}

/** What the index holds for a key: the item, and where it was last known to be. */
export interface KeyedItemEntry<T> {
  item: T;
  /** The position of the item in the array it was last seen in: a hint, stale once items move. */
  index: number;
}

/**
 * The first item of an array for each key (`find` semantics when several
 * items share a key), brought from one array to the next by what changed
 * between them. Where a rebuild reads the key of every item, `sync` reads the
 * keys of the items that were replaced, added or removed, which is what
 * keeps a watch flush of a few objects from costing a pass over a list of
 * 100k.
 *
 * Items are expected to keep their key for as long as they are in an array.
 */
export class KeyedItemIndex<T> {
  private entries = new Map<string, KeyedItemEntry<T>>();
  // The array the index describes, as a copy that nothing writes to.
  private described: readonly T[] | undefined;
  // The array `described` was taken from, to tell a repeated sync at once.
  private source: readonly T[] | undefined;
  // False once an array had two items with one key: which of them a map holds
  // is then decided by position, which the segments do not carry.
  private incremental = true;

  constructor(private readonly keyOf: (item: T) => string) {}

  /** Whether the index describes some array yet. */
  get isBuilt(): boolean {
    return this.described !== undefined;
  }

  get(key: string): KeyedItemEntry<T> | undefined {
    return this.entries.get(key);
  }

  /** Whether `items` is something other than the array the index describes, compared item by item. */
  differsFrom(items: readonly T[]): boolean {
    const described = this.described;

    if (!described || described.length !== items.length) return true;

    for (let position = 0; position < items.length; position += 1) {
      if (described[position] !== items[position]) return true;
    }

    return false;
  }

  /**
   * Makes the index describe `items`. With `owned`, the caller hands over a
   * copy it never writes to; otherwise the index copies the array.
   */
  sync(items: readonly T[], owned = false): void {
    if (this.source === items && this.described && this.described.length === items.length && owned) {
      return;
    }

    const described = this.described;

    if (described && this.incremental) {
      const segments = diffByIdentity(described, items, Math.max(64, items.length >> 2));

      if (segments && this.apply(described, items, segments)) {
        if (segments.length > 0) {
          this.described = owned ? items : items.slice();
        }

        this.source = items;

        return;
      }
    }

    this.rebuild(items, owned);
  }

  private apply(prev: readonly T[], next: readonly T[], segments: ArraySegment[]): boolean {
    // Every removal comes before any addition, so that an item that moved
    // finds its old place free.
    for (const { prevFrom, prevTo } of segments) {
      for (let position = prevFrom; position < prevTo; position += 1) {
        const item = prev[position];
        const key = this.keyOf(item);

        if (this.entries.get(key)?.item !== item) return false;

        this.entries.delete(key);
      }
    }

    for (const { nextFrom, nextTo } of segments) {
      for (let position = nextFrom; position < nextTo; position += 1) {
        const item = next[position];
        const key = this.keyOf(item);

        if (this.entries.has(key)) return false;

        this.entries.set(key, { item, index: position });
      }
    }

    return true;
  }

  private rebuild(items: readonly T[], owned: boolean): void {
    const entries = new Map<string, KeyedItemEntry<T>>();
    let duplicates = false;

    for (let position = 0; position < items.length; position += 1) {
      const item = items[position];
      const key = this.keyOf(item);

      if (entries.has(key)) {
        duplicates = true;
      } else {
        entries.set(key, { item, index: position });
      }
    }

    this.entries = entries;
    this.incremental = !duplicates;
    this.described = owned ? items : items.slice();
    this.source = items;
  }
}
