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
  const order: number[] = new Array(length);

  for (let i = 0; i < length; i++) {
    order[i] = i;
  }

  if (!anyArray) {
    order.sort((left, right) => compareKeys(keys[left], keys[right], sign));
  } else {
    // A single value is a key of one part. flat(0) copies an array key without its holes, as
    // [key].flat() did.
    const parts: (string | number | undefined)[][] = new Array(length);

    for (let i = 0; i < length; i++) {
      const key = keys[i];

      parts[i] = Array.isArray(key) ? key.flat(0) : [key as string | number | undefined];
    }

    order.sort((left, right) => {
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
    });
  }

  const sorted: T[] = new Array(length);

  for (let i = 0; i < length; i++) {
    sorted[i] = rawItems[order[i]];
  }

  return sorted;
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
