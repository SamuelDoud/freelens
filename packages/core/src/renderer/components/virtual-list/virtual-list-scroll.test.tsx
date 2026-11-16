/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "@testing-library/jest-dom/vitest";

import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VirtualList } from "./virtual-list";

const items = (count: number) =>
  [...new Array(count)].map((_, index) => ({
    getId: () => `id-${index}`,
  }));

const list = (selectedItemId?: string, count = 100) => (
  <VirtualList
    items={items(count)}
    rowHeights={new Array(count).fill(15)}
    fixedHeight={45}
    selectedItemId={selectedItemId}
    getRow={(id) => <div data-testid={id}>{id}</div>}
  />
);

describe("VirtualList scrolling to the selected item", () => {
  it("leaves a list the user scrolled away alone when its items are replaced", () => {
    const { container, rerender, queryByTestId } = render(list("id-30"));
    const element = container.querySelector<HTMLElement>(".list")!;

    expect(queryByTestId("id-30")).toBeInTheDocument();

    element.scrollTop = 0;
    fireEvent.scroll(element);

    expect(queryByTestId("id-0")).toBeInTheDocument();

    // A watch event gives the list new items; the selection has not changed.
    rerender(list("id-30", 101));

    expect(queryByTestId("id-0")).toBeInTheDocument();
  });

  it("scrolls to an item that becomes selected", () => {
    const { rerender, queryByTestId } = render(list());

    rerender(list("id-30"));

    expect(queryByTestId("id-30")).toBeInTheDocument();
  });
});
