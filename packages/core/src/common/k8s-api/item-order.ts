/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * The order `ItemStore.sortItems` gives `items`, as functions that can be
 * applied to part of a list: comparing two items, sorting a list, and merging
 * a few items into a list that is already sorted. They follow
 * `orderBy(items, by, order)` of es-toolkit exactly, including the placement of
 * `undefined`, `null` and `NaN`, and a stable result: items that compare equal
 * keep their order in the list.
 */

type Criterion = unknown;

const priority = (value: unknown): number => {
  if (typeof value === "symbol") return 1;
  if (value === null) return 2;
  if (value === undefined) return 3;
  if (value !== value) return 4;

  return 0;
};

/** `compareValues` of es-toolkit's compat `orderBy`, which `ItemStore.sortItems` uses. */
function compareValues(a: any, b: any, order: string | undefined): number {
  if (a !== b) {
    // The common keys: two strings, or two numbers that are not NaN.
    if (
      (typeof a === "string" && typeof b === "string") ||
      (typeof a === "number" && typeof b === "number" && a === a && b === b)
    ) {
      return a < b === (order !== "desc") ? -1 : 1;
    }

    const aPriority = priority(a);
    const bPriority = priority(b);

    if (aPriority === bPriority && aPriority === 0) {
      if (a < b) return order === "desc" ? 1 : -1;
      if (a > b) return order === "desc" ? -1 : 1;
    }

    return order === "desc" ? bPriority - aPriority : aPriority - bPriority;
  }

  return 0;
}

export class ItemOrder<Item> {
  private readonly by: readonly ((item: Item) => unknown)[];
  // Only the first key takes the order, as in orderBy.
  private readonly order: string | undefined;

  constructor(by: readonly ((item: Item) => unknown)[], order?: "asc" | "desc") {
    // orderBy sorts by the value itself when there is no function to sort by.
    this.by = by.length > 0 ? by : [(item) => item];
    this.order = order == null ? undefined : String(order);
  }

  criteria(item: Item): Criterion[] {
    return this.by.map((sortBy) => sortBy(item));
  }

  /** Negative when `a` sorts before `b`, positive after, zero when the order does not tell them apart. */
  compareCriteria(a: readonly Criterion[], b: readonly Criterion[]): number {
    for (let index = 0; index < a.length; index += 1) {
      const result = compareValues(a[index], b[index], index === 0 ? this.order : undefined);

      if (result !== 0) {
        return result;
      }
    }

    return 0;
  }

  compare(a: Item, b: Item): number {
    for (let index = 0; index < this.by.length; index += 1) {
      const result = compareValues(this.by[index](a), this.by[index](b), index === 0 ? this.order : undefined);

      if (result !== 0) {
        return result;
      }
    }

    return 0;
  }

  /** `compareCriteria` of the criteria of an item and the item, without making the criteria of the item. */
  private compareCriteriaTo(criteria: readonly Criterion[], item: Item): number {
    for (let index = 0; index < this.by.length; index += 1) {
      const result = compareValues(criteria[index], this.by[index](item), index === 0 ? this.order : undefined);

      if (result !== 0) {
        return result;
      }
    }

    return 0;
  }

  /** The same items in the order `orderBy` gives them. */
  sort(items: readonly Item[]): Item[] {
    const criteria = items.map((item) => this.criteria(item));
    const positions = Array.from(items, (_, index) => index);

    positions.sort((a, b) => this.compareCriteria(criteria[a], criteria[b]) || a - b);

    return positions.map((position) => items[position]);
  }

  /** Whether `items` is in the order `sort` gives, which lets `merge` add to it without sorting it. */
  isSorted(items: readonly Item[]): boolean {
    for (let index = 1; index < items.length; index += 1) {
      if (this.compare(items[index - 1], items[index]) > 0) {
        return false;
      }
    }

    return true;
  }

  /**
   * Puts `added` into `sorted`, which has to be in the order `sort` gives,
   * and returns what `sort` would give for `[...sorted, ...added]`: an added
   * item goes after the items of `sorted` it ties with, and keeps its order
   * among the added ones that tie with it.
   */
  merge(sorted: readonly Item[], added: readonly Item[]): Item[] {
    return this.mergeRanked(
      sorted,
      sorted.map((_, index) => index),
      added.map((item, index) => ({ item, rank: sorted.length + index })),
    );
  }

  /**
   * The general form of `merge`: every item has a rank, the position it has in
   * the list that is sorted, and ties go to the lower rank. `ranks[i]` is the
   * rank of `sorted[i]` and rises with `i`.
   */
  mergeRanked(
    sorted: readonly Item[],
    ranks: ArrayLike<number>,
    added: readonly { item: Item; rank: number }[],
  ): Item[] {
    const ordered = added
      .map((entry) => ({ ...entry, criteria: this.criteria(entry.item) }))
      .sort((a, b) => this.compareCriteria(a.criteria, b.criteria) || a.rank - b.rank);
    const result: Item[] = new Array(sorted.length + ordered.length);
    let from = 0;
    let out = 0;

    for (const entry of ordered) {
      // The first item that sorts after the entry, from where the last one went in.
      let low = from;
      let high = sorted.length;

      while (low < high) {
        const middle = (low + high) >>> 1;
        const comparison = this.compareCriteriaTo(entry.criteria, sorted[middle]);

        if (comparison < 0 || (comparison === 0 && entry.rank < ranks[middle])) {
          high = middle;
        } else {
          low = middle + 1;
        }
      }

      for (; from < low; from += 1) {
        result[out++] = sorted[from];
      }

      result[out++] = entry.item;
    }

    for (; from < sorted.length; from += 1) {
      result[out++] = sorted[from];
    }

    return result;
  }
}
