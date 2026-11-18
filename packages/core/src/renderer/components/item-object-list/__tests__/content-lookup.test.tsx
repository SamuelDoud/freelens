/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { isObservableArray, observable, runInAction } from "mobx";
import { describe, expect, it, vi } from "vitest";
import { NonInjectedItemListLayoutContent } from "../content";

import type { ItemObject } from "@freelensapp/list-layout";

import type { ItemListLayoutContentProps } from "../content";

type Item = ItemObject & { label: string };

const makeItem = (id: string, label = id): Item => ({
  getId: () => id,
  getName: () => `name-${label}`,
  label,
});

type Props = ConstructorParameters<typeof NonInjectedItemListLayoutContent>[0] &
  ItemListLayoutContentProps<ItemObject, boolean>;

const makeProps = (overrides: Record<string, unknown>) =>
  ({
    getFilters: () => [],
    className: "",
    getItems: () => [],
    store: {
      isSelected: () => false,
      toggleSelection: () => {},
      isSelectedAll: () => false,
      toggleSelectionAll: () => {},
    },
    getIsReady: () => true,
    renderTableContents: (item: ItemObject) => [item.getName()],
    renderTableHeader: [{ title: "Name", id: "name" }],
    columnResizeStorage: { get: () => ({}) },
    isTableColumnHidden: vi.fn(),
    ...overrides,
  }) as unknown as Props;

// getRow wraps an <Observer> whose child function resolves the item of the row.
const renderRowItem = (component: NonInjectedItemListLayoutContent<ItemObject, boolean>, uid: string) => {
  const row = component.getRow(uid) as any;
  const element = row.props.children.props.children();

  return element === null ? null : (element.props.searchItem as Item);
};

describe("<ItemListLayoutContent> row lookup", () => {
  it("resolves each row to the item with its id, in order", () => {
    const items = [makeItem("a"), makeItem("b"), makeItem("c")];
    const component = new NonInjectedItemListLayoutContent(makeProps({ getItems: () => items }));

    expect(items.map((item) => renderRowItem(component, item.getId()))).toEqual(items);
    expect((component.renderItems() as any[]).map((row) => row.key)).toEqual(["a", "b", "c"]);
  });

  it("lets the first of several items with the same id win", () => {
    const first = makeItem("dup", "first");
    const second = makeItem("dup", "second");
    const component = new NonInjectedItemListLayoutContent(makeProps({ getItems: () => [first, second] }));

    expect(renderRowItem(component, "dup")).toBe(first);
  });

  it("renders nothing for an id that is not in the list", () => {
    const component = new NonInjectedItemListLayoutContent(makeProps({ getItems: () => [makeItem("a")] }));

    expect(renderRowItem(component, "missing")).toBeNull();
  });

  it("follows a new items array", () => {
    let items = [makeItem("a", "old")];
    const component = new NonInjectedItemListLayoutContent(makeProps({ getItems: () => items }));

    expect(renderRowItem(component, "a")?.label).toBe("old");

    items = [makeItem("b"), makeItem("a", "new")];

    expect(renderRowItem(component, "a")?.label).toBe("new");
    expect(renderRowItem(component, "b")?.label).toBe("b");
  });

  it("follows an array that is changed in place", () => {
    const items = [makeItem("a", "old")];
    const component = new NonInjectedItemListLayoutContent(makeProps({ getItems: () => items }));

    expect(renderRowItem(component, "a")?.label).toBe("old");

    items.splice(0, 1, makeItem("a", "new"));

    expect(renderRowItem(component, "a")?.label).toBe("new");
  });
});

describe("<ItemListLayoutContent> select-all checkbox", () => {
  // The select-all cell comes after the cell of the arrow that opens a row's details.
  const header = (component: NonInjectedItemListLayoutContent<ItemObject, boolean>) =>
    (component.renderTableHeader() as any).props.children[1];

  it("leaves out items that the row customization disables", () => {
    const items = [makeItem("a"), makeItem("b"), makeItem("c")];
    const toggleSelectionAll = vi.fn();
    const component = new NonInjectedItemListLayoutContent(
      makeProps({
        getItems: () => items,
        isSelectable: true,
        customizeTableRowProps: (item: ItemObject) => ({ disabled: item.getId() === "b" }),
        store: { isSelectedAll: () => false, toggleSelectionAll },
      }),
    );

    const cell = header(component).props.children().props;

    cell.onClick({ preventDefault: () => {}, stopPropagation: () => {} });

    expect(toggleSelectionAll).toHaveBeenCalledWith([items[0], items[2]]);
  });

  it("does not render the checkbox of a list that is not selectable", () => {
    const customizeTableRowProps = vi.fn(() => ({}));
    const component = new NonInjectedItemListLayoutContent(
      makeProps({
        getItems: () => [makeItem("a")],
        isSelectable: false,
        customizeTableRowProps,
      }),
    );

    expect(header(component)).toBe(false);
    expect(customizeTableRowProps).not.toHaveBeenCalled();
  });
});

// The lookup as it was when an index was built again for every items array (dev/2.5.0 content.tsx).
class ReferenceLookup {
  private itemIndex?: { items: Item[]; length: number; byId: Map<string, number> };

  find(items: Item[], uid: string): Item | undefined {
    if (isObservableArray(items)) {
      return items.find((item) => item.getId() === uid);
    }

    for (let attempt = 0; attempt < 2; attempt++) {
      if (this.itemIndex?.items !== items || this.itemIndex.length !== items.length) {
        const byId = new Map<string, number>();

        items.forEach((item, index) => {
          const id = item.getId();

          if (!byId.has(id)) {
            byId.set(id, index);
          }
        });

        this.itemIndex = { items, length: items.length, byId };
      }

      const index = this.itemIndex.byId.get(uid);

      if (index === undefined) {
        break;
      }

      const item = items[index];

      if (item.getId() === uid) {
        return item;
      }

      this.itemIndex = undefined;
    }

    return items.find((item) => item.getId() === uid);
  }
}

const random = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;

  return seed / 2 ** 32;
};

describe("<ItemListLayoutContent> row lookup, incremental against an index for every array", () => {
  const lookups = (component: NonInjectedItemListLayoutContent<ItemObject, boolean>, items: Item[], uid: string) =>
    (component as any).findItemById(items, uid) as Item | undefined;

  const run = (seed: number, options: { duplicates: boolean; inPlace: boolean; observableArray: boolean }) => {
    const next = random(seed);

    for (let round = 0; round < 40; round++) {
      const component = new NonInjectedItemListLayoutContent(makeProps({}));
      const reference = new ReferenceLookup();
      let counter = 0;
      const fresh = (label = "v0") => {
        counter += 1;

        return makeItem(options.duplicates && next() < 0.15 ? `id-${Math.floor(next() * 12)}` : `id-${counter}`, label);
      };
      let items: Item[] = Array.from({ length: 20 }, () => fresh());
      const target = options.observableArray ? observable.array(items, { deep: false }) : undefined;

      for (let step = 0; step < 25; step++) {
        const edits = 1 + Math.floor(next() * 4);

        if (options.inPlace && next() < 0.4) {
          // The same array, written to: as many items afterwards as before, or another number.
          for (let edit = 0; edit < edits; edit++) {
            const at = Math.floor(next() * items.length);
            const kind = next();

            if (kind < 0.5 && items.length) {
              items[at % items.length] = makeItem(items[at % items.length].getId(), `step-${step}`);
            } else if (kind < 0.75 && items.length) {
              // Another id, one that no item has, so that no earlier duplicate appears.
              items[at % items.length] = makeItem(`fresh-${round}-${step}-${edit}`);
            } else if (kind < 0.9) {
              items.push(makeItem(`pushed-${round}-${step}-${edit}`));
            } else if (items.length) {
              items.pop();
            }
          }

          if (target) {
            runInAction(() => target.replace(items));
          }
        } else {
          const copy = items.slice();

          for (let edit = 0; edit < edits; edit++) {
            const at = Math.floor(next() * (copy.length + 1));
            const kind = next();

            if (kind < 0.3 && copy.length) {
              copy.splice(at % copy.length, 1);
            } else if (kind < 0.55) {
              copy.splice(at, 0, fresh());
            } else if (kind < 0.9 && copy.length) {
              copy[at % copy.length] = makeItem(copy[at % copy.length].getId(), `step-${step}`);
            } else if (kind < 0.95) {
              copy.reverse();
            } else {
              copy.length = 0;
              copy.push(...Array.from({ length: Math.floor(next() * 30) }, () => fresh()));
            }
          }

          items = copy;

          if (target) {
            runInAction(() => target.replace(items));
          }
        }

        const given = target ?? items;
        const uids = [...new Set([...given.map((item) => item.getId()), "missing"])];

        for (let pass = 0; pass < 2; pass++) {
          for (const uid of uids) {
            const expected = reference.find(given, uid);

            expect(lookups(component, given, uid)).toBe(expected);

            if (!options.duplicates) {
              expect(expected).toBe(given.find((item) => item.getId() === uid));
            }
          }
        }
      }
    }
  };

  it("resolves every id as before over new arrays", () => {
    run(1, { duplicates: false, inPlace: false, observableArray: false });
  });

  it("resolves every id as before when ids repeat", () => {
    run(2, { duplicates: true, inPlace: false, observableArray: false });
  });

  it("resolves every id as before when the array is also changed in place", () => {
    run(3, { duplicates: false, inPlace: true, observableArray: false });
  });

  it("resolves every id as before for an observable array", () => {
    run(4, { duplicates: true, inPlace: true, observableArray: true });
  });

  it("reads the id of the items that changed, not of every item", () => {
    let reads = 0;
    const make = (id: string) => ({
      getId: () => {
        reads += 1;

        return id;
      },
      getName: () => id,
      label: id,
    });
    let items = Array.from({ length: 3000 }, (_, i) => make(`id-${i}`));
    const component = new NonInjectedItemListLayoutContent(makeProps({}));

    expect(lookups(component, items, "id-5")).toBe(items[5]);

    reads = 0;
    items = items.slice();

    for (let at = 0; at < items.length; at += 100) {
      items[at] = make(items[at].getId());
    }

    items.splice(1500, 0, make("added"));
    reads = 0;

    for (let row = 0; row < 50; row++) {
      lookups(component, items, `id-${row * 50 + 1}`);
    }

    // A rebuild reads 3000 ids. The change is 30 replacements and one addition.
    expect(reads).toBeLessThan(150);
  });
});
