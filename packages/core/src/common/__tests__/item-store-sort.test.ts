/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { ItemStore } from "../item.store";

// Minimal concrete subclass to test sortItems
class TestStore extends ItemStore<any> {
  // Expose protected method for testing
  public testSortItems(items: any[], sorting?: ((item: any) => any)[], order?: "asc" | "desc") {
    return this.sortItems(items, sorting, order);
  }
}

function makeItems(names: string[]) {
  return names.map((name) => ({
    getName: () => name,
    getId: () => name,
  }));
}

describe("sortItems early exit", () => {
  let store: TestStore;

  beforeEach(() => {
    store = new TestStore();
  });

  it("returns same reference when items are already sorted ascending", () => {
    const items = makeItems(["alice", "bob", "charlie"]);
    const result = store.testSortItems(items);

    // Should return the exact same array reference (early exit)
    expect(result).toBe(items);
  });

  it("sorts when items are not in order", () => {
    const items = makeItems(["charlie", "alice", "bob"]);
    const result = store.testSortItems(items);

    expect(result.map((i: any) => i.getName())).toEqual(["alice", "bob", "charlie"]);
    // Should be a new array (orderBy creates a copy)
    expect(result).not.toBe(items);
  });

  it("handles single-item array", () => {
    const items = makeItems(["solo"]);
    const result = store.testSortItems(items);

    expect(result.map((i: any) => i.getName())).toEqual(["solo"]);
  });

  it("handles empty array", () => {
    const result = store.testSortItems([]);

    expect(result).toEqual([]);
  });

  it("does not early-exit for descending order", () => {
    const items = makeItems(["alice", "bob", "charlie"]);
    const result = store.testSortItems(items, [(i) => i.getName()], "desc");

    // Descending should reverse the order
    expect(result.map((i: any) => i.getName())).toEqual(["charlie", "bob", "alice"]);
  });

  it("does not early-exit for multi-key sorting", () => {
    const items = makeItems(["alice", "bob"]);
    const result = store.testSortItems(items, [(i) => i.getName(), (i) => i.getId()]);

    // Multi-key bypasses early exit, goes through orderBy
    expect(result.map((i: any) => i.getName())).toEqual(["alice", "bob"]);
  });
});
