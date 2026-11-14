/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

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
