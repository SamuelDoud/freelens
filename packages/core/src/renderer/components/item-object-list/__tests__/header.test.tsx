/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "@testing-library/jest-dom/vitest";

import { render } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { ItemListLayoutHeader } from "../header";

import type { ItemObject } from "@freelensapp/list-layout";

import type { ItemListStore } from "../list-layout";

const storeWith = (overrides: Record<string, unknown>): ItemListStore<ItemObject, boolean> =>
  ({
    isLoaded: false,
    failedLoading: false,
    getTotalCount: () => 0,
    isSelected: () => false,
    toggleSelection: () => {},
    isSelectedAll: () => false,
    toggleSelectionAll: () => {},
    pickOnlySelected: (items: ItemObject[]) => items,
    removeItems: async () => {},
    selectedItems: [],
    ...overrides,
  }) as ItemListStore<ItemObject, boolean>;

const renderHeader = (store: ItemListStore<ItemObject, boolean>) =>
  render(
    <ItemListLayoutHeader
      showHeader
      store={store}
      getItems={() => []}
      getFilters={() => []}
      toggleFilters={() => {}}
      renderHeaderTitle="Pods"
    />,
  );

describe("ItemListLayoutHeader", () => {
  it("shows the item count when not streaming", () => {
    const { container } = renderHeader(storeWith({ getTotalCount: () => 1234, isLoaded: true }));

    expect(container.querySelector(".info-panel")).toHaveTextContent("1234 items");
  });

  it("shows streaming progress with the expected total while loading", () => {
    const { container } = renderHeader(storeWith({ loadingProgress: { loaded: 51234, total: 201234 } }));

    expect(container.querySelector(".info-panel")).toHaveTextContent("Loading… 51,234 / 201,234 items");
  });

  it("shows streaming progress without a total when none is known", () => {
    const { container } = renderHeader(storeWith({ loadingProgress: { loaded: 51234 } }));

    expect(container.querySelector(".info-panel")).toHaveTextContent("Loading… 51,234 items");
  });
});
