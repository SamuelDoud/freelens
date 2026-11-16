/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { sortCompare } from "@freelensapp/utilities";

import type { ItemObject } from "@freelensapp/list-layout";

import type { TableOrderBy, TableSortCallback } from "./table";

// A key without a value (undefined, null or NaN) goes after every other key in either direction and
// equals its like, so the comparator stays consistent.
const isMissing = (key: unknown) => key === undefined || key === null || Number.isNaN(key);

function compareKeys(left: unknown, right: unknown, sign: 1 | -1) {
  const leftMissing = isMissing(left);
  const rightMissing = isMissing(right);

  if (leftMissing || rightMissing) {
    return leftMissing === rightMissing ? 0 : leftMissing ? 1 : -1;
  }

  return sign * sortCompare(left, right);
}

export function getSorted<T>(
  rawItems: T[],
  sortingCallback: TableSortCallback<T> | undefined,
  orderBy: TableOrderBy = "asc",
  /**
   * The result of an earlier call for a similar list. When most of it is still in the list it is a
   * sorted run that is merged with the sorted rest instead of sorting everything again. It only
   * speeds the call up: the result is the same without it.
   */
  previous?: readonly T[],
): T[] {
  if (typeof sortingCallback !== "function") {
    return rawItems;
  }

  // Each key is built once per item and the sort orders indexes, so that
  // the comparator allocates nothing and ties stay in input order.
  const length = rawItems.length;
  const keys: ReturnType<TableSortCallback<T>>[] = new Array(length);
  let anyArray = false;

  for (let i = 0; i < length; i++) {
    const key = sortingCallback(rawItems[i]);

    keys[i] = key;

    if (Array.isArray(key)) {
      anyArray = true;
    }
  }

  const sign: 1 | -1 = orderBy === "desc" ? -1 : 1;

  // The order of the keys alone, 0 for a tie.
  let compare: (left: number, right: number) => number;

  if (!anyArray) {
    compare = (left, right) => compareKeys(keys[left], keys[right], sign);
  } else {
    // A single value is a key of one part. flat(0) copies an array key without its holes, as
    // [key].flat() did.
    const parts: (string | number | undefined)[][] = new Array(length);

    for (let i = 0; i < length; i++) {
      const key = keys[i];

      parts[i] = Array.isArray(key) ? key.flat(0) : [key as string | number | undefined];
    }

    compare = (left, right) => {
      const leftParts = parts[left];
      const rightParts = parts[right];
      const common = Math.min(leftParts.length, rightParts.length);

      for (let i = 0; i < common; i++) {
        const ordering = compareKeys(leftParts[i], rightParts[i], sign);

        if (ordering !== 0) {
          return ordering;
        }
      }

      // The shorter key first, whichever the direction.
      return leftParts.length - rightParts.length;
    };
  }

  const order =
    (previous && hasUniformStringKeys(keys) && mergeWithPrevious(rawItems, previous, compare)) ||
    sortIndexes(length, compare);
  const sorted: T[] = new Array(length);

  for (let i = 0; i < length; i++) {
    sorted[i] = rawItems[order[i]];
  }

  return sorted;
}

/**
 * Whether the keys are numbers or strings, the same kind at every position of a key, and the first
 * position of a key a string. Only uniform kinds give a total order, the one the merge relies on:
 * `<` on a mix of kinds is not transitive. Number keys are left to the plain sort, which is
 * faster for them than finding the previous run is worth.
 */
function hasUniformStringKeys(keys: readonly unknown[]): boolean {
  const kinds: string[] = [];

  for (const key of keys) {
    const keyParts: readonly unknown[] = Array.isArray(key) ? key.flat(0) : [key];

    for (let position = 0; position < keyParts.length; position++) {
      const part = keyParts[position];

      if (isMissing(part)) {
        continue;
      }

      const kind = typeof part;

      if (kind !== "number" && kind !== "string") {
        return false;
      }

      if (kinds[position] === undefined) {
        kinds[position] = kind;
      } else if (kinds[position] !== kind) {
        return false;
      }
    }
  }

  return kinds[0] === "string";
}

function sortIndexes(length: number, compare: (left: number, right: number) => number): number[] {
  const order: number[] = new Array(length);

  for (let i = 0; i < length; i++) {
    order[i] = i;
  }

  // Array.prototype.sort is stable, so equal keys stay in input order.
  return order.sort(compare);
}

// Below this many items a sort is cheap enough that nothing is worth saving.
const MERGE_MIN_LENGTH = 512;

// More new items than this fraction of the list and the sort of them costs as much as the full one.
const MERGE_MAX_NEW_FRACTION = 8;

/**
 * The indexes of `rawItems` in the order a stable sort by `compare` gives, found by merging the
 * items that were in `previous` (already in order, if their keys did not change) with the sorted
 * rest. Undefined when that does not apply: the run is not in order under the current keys, or too
 * much of the list is new. Both orders are total, key first and then input index, so the merge
 * gives exactly what the stable sort gives.
 */
function mergeWithPrevious<T>(
  rawItems: readonly T[],
  previous: readonly T[],
  compare: (left: number, right: number) => number,
): number[] | undefined {
  const length = rawItems.length;

  if (length < MERGE_MIN_LENGTH || previous.length === 0) {
    return undefined;
  }

  const indexOf = new Map<T, number>();

  for (let i = 0; i < length; i++) {
    indexOf.set(rawItems[i], i);
  }

  // The same item twice in the list has no single index.
  if (indexOf.size !== length) {
    return undefined;
  }

  const inRun = new Uint8Array(length);
  const run: number[] = [];

  for (let i = 0; i < previous.length; i++) {
    const index = indexOf.get(previous[i]);

    if (index !== undefined && inRun[index] === 0) {
      inRun[index] = 1;
      run.push(index);
    }
  }

  const extraCount = length - run.length;

  if (extraCount * MERGE_MAX_NEW_FRACTION > length) {
    return undefined;
  }

  // The total order: by key, ties by input index.
  const before = (left: number, right: number) => {
    const ordering = compare(left, right);

    return ordering !== 0 ? ordering < 0 : left < right;
  };

  for (let i = 1; i < run.length; i++) {
    if (!before(run[i - 1], run[i])) {
      return undefined;
    }
  }

  const extras: number[] = [];

  for (let i = 0; i < length; i++) {
    if (inRun[i] === 0) {
      extras.push(i);
    }
  }

  extras.sort((left, right) => compare(left, right) || left - right);

  const order: number[] = new Array(length);
  let runAt = 0;
  let extraAt = 0;

  for (let i = 0; i < length; i++) {
    if (extraAt >= extras.length || (runAt < run.length && before(run[runAt], extras[extraAt]))) {
      order[i] = run[runAt++];
    } else {
      order[i] = extras[extraAt++];
    }
  }

  return order;
}

/**
 * The items with the ones whose id has a position placed at it, and the others after them in the
 * order they came. Items of one id share a position and keep their order. `length` is the number of
 * positions there were when the order was taken.
 */
export function applyHeldPositions<Item extends ItemObject>(
  sortedItems: Item[],
  positions: Map<string, number>,
  length: number,
): Item[] {
  const slots: (Item | undefined)[] = new Array(length);
  const sharing = new Map<number, Item[]>();
  const unknown: Item[] = [];

  for (const item of sortedItems) {
    const position = positions.get(item.getId());

    if (position === undefined) {
      unknown.push(item);
    } else if (slots[position] === undefined) {
      slots[position] = item;
    } else {
      const others = sharing.get(position);

      if (others) {
        others.push(item);
      } else {
        sharing.set(position, [item]);
      }
    }
  }

  const result: Item[] = [];

  for (let position = 0; position < length; position++) {
    const item = slots[position];

    if (item !== undefined) {
      result.push(item);

      const others = sharing.size ? sharing.get(position) : undefined;

      if (others) {
        for (const other of others) {
          result.push(other);
        }
      }
    }
  }

  for (const item of unknown) {
    result.push(item);
  }

  return result;
}
