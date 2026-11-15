/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "@testing-library/jest-dom/vitest";
import { act } from "@testing-library/react";
import { observable, runInAction } from "mobx";
import { describe, expect, it, vi } from "vitest";
import { getDiForUnitTesting } from "../../../getDiForUnitTesting";
import { renderFor } from "../../test-utils/renderFor";
import { NonInjectedItemListLayoutContent } from "../content";

import type { ItemObject } from "@freelensapp/list-layout";

import type { ItemListLayoutContentProps } from "../content";

type Item = ItemObject & { label: string };

const makeItem = (id: string, label = id): Item => ({ getId: () => id, getName: () => `name-${label}`, label });

describe("<ItemListLayoutContent> row rendering", () => {
  const setup = () => {
    const items = observable.array<Item>(
      ["a", "b", "c", "d"].map((id) => makeItem(id)),
      { deep: false },
    );
    const renderTableContents = vi.fn((item: ItemObject) => [item.getName()]);
    const component = new NonInjectedItemListLayoutContent({
      getFilters: () => [],
      className: "",
      getItems: () => items.slice(),
      store: { isSelected: () => false, toggleSelection: () => {} },
      getIsReady: () => true,
      renderTableContents,
      renderTableHeader: [{ title: "Name", id: "name" }],
      columnResizeStorage: { get: () => ({}) },
      isTableColumnHidden: vi.fn(),
    } as unknown as ConstructorParameters<typeof NonInjectedItemListLayoutContent>[0] &
      ItemListLayoutContentProps<ItemObject, boolean>);
    const render = renderFor(getDiForUnitTesting());
    // The rows a list shows: the first three of four.
    const rows = () => (
      <div>
        {["a", "b", "c"].map((uid) => (
          <div key={uid} data-testid={uid}>
            {component.getRow(uid)}
          </div>
        ))}
      </div>
    );
    const result = render(rows());

    return { items, renderTableContents, result, again: () => result.rerender(rows()) };
  };

  it("renders a row again only when its own item is replaced", () => {
    const { items, renderTableContents, result, again } = setup();

    expect(renderTableContents).toHaveBeenCalledTimes(3);
    renderTableContents.mockClear();

    // The list is given another array, and a row of the list is asked for again.
    again();
    act(() => runInAction(() => items.replace([...items])));
    expect(renderTableContents).not.toHaveBeenCalled();

    // An item the screen does not show.
    act(() => runInAction(() => items.splice(3, 1, makeItem("d", "new"))));
    expect(renderTableContents).not.toHaveBeenCalled();

    // An item it shows.
    act(() => runInAction(() => items.splice(1, 1, makeItem("b", "new"))));
    expect(renderTableContents).toHaveBeenCalledTimes(1);
    expect(result.getByText("name-new")).toBeInTheDocument();
  });
});
