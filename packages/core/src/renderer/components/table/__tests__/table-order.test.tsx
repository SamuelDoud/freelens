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
import { applyHeldPositions } from "../sorting";
import { Table } from "../table";
import { TableCell } from "../table-cell";
import { TableHead } from "../table-head";

import type { ItemObject } from "@freelensapp/list-layout";

import type { TableProps } from "../table";

const virtualListProps: { items: Item[]; rowHeights: number[] }[] = [];

vi.mock("../../virtual-list", () => ({
  VirtualList: (props: { items: Item[]; rowHeights: number[] }) => {
    virtualListProps.push(props);

    return null;
  },
}));

type Item = ItemObject & { name: string };

const makeItem = (id: string, name = id): Item => ({ getId: () => id, getName: () => name, name });
const lastProps = () => virtualListProps[virtualListProps.length - 1];
const lastIds = () => lastProps().items.map((item) => item.getId());

describe("applyHeldPositions", () => {
  // The stable sort by position the held order used before.
  const reference = (items: Item[], positions: Map<string, number>) => {
    const position = (item: Item) => positions.get(item.getId()) ?? Number.POSITIVE_INFINITY;

    return [...items].sort((left, right) => {
      const difference = position(left) - position(right);

      return Number.isNaN(difference) ? 0 : difference;
    });
  };

  it("places the items like a stable sort by position, with repeated and unknown ids", () => {
    let seed = 7;
    const next = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;

      return seed / 4294967296;
    };

    for (let round = 0; round < 200; round++) {
      const ids = Array.from({ length: 1 + Math.floor(next() * 12) }, () => `id${Math.floor(next() * 10)}`);
      const held = ids.map((id) => makeItem(id));
      const positions = new Map(held.map((item, index) => [item.getId(), index]));
      const now = Array.from({ length: Math.floor(next() * 15) }, (_, index) =>
        makeItem(`id${Math.floor(next() * 14)}`, `n${index}`),
      );

      expect(applyHeldPositions(now, positions, held.length)).toStrictEqual(reference(now, positions));
    }
  });
});

describe("<Table> virtual order", () => {
  const render = renderFor(getDiForUnitTesting());

  const renderTable = (props: Partial<TableProps<Item>> & { items: Item[] }) => {
    const element = (current: typeof props) => (
      <Table<Item>
        tableId="test-table"
        virtual
        sortSyncWithUrl={false}
        sortByDefault={{ sortBy: "name", orderBy: "asc" }}
        {...current}
      >
        <TableHead>
          <TableCell sortBy="name">Name</TableCell>
        </TableHead>
      </Table>
    );
    const result = render(element(props));

    return { rerender: (next: typeof props) => result.rerender(element(next)) };
  };

  it("sorts again only when the items, the sort or the callback change", () => {
    const items = [makeItem("b"), makeItem("a"), makeItem("c")];
    const byName = vi.fn((item: Item) => item.name);
    const sortable = { name: byName };
    const { rerender } = renderTable({ items, sortable });

    expect(lastIds()).toEqual(["a", "b", "c"]);
    expect(byName).toHaveBeenCalledTimes(3);

    rerender({ items, sortable, className: "other" });
    expect(byName).toHaveBeenCalledTimes(3);

    const same = lastProps().items;

    rerender({ items, sortable, className: "again" });
    expect(lastProps().items).toBe(same);

    rerender({ items: [...items, makeItem("0")], sortable });
    expect(byName).toHaveBeenCalledTimes(7);
    expect(lastIds()).toEqual(["0", "a", "b", "c"]);

    const another = { name: (item: Item) => item.name };

    rerender({ items: [...items, makeItem("0")], sortable: another });
    expect(byName).toHaveBeenCalledTimes(7);
  });

  it("sorts again when an observable that a sort callback reads changes", () => {
    const rank = observable.map<string, number>({ a: 2, b: 1 });
    const items = [makeItem("a"), makeItem("b")];

    renderTable({ items, sortable: { name: (item: Item) => rank.get(item.getId()) ?? 0 } });
    expect(lastIds()).toEqual(["b", "a"]);

    act(() => runInAction(() => rank.set("b", 3)));
    expect(lastIds()).toEqual(["a", "b"]);
  });

  it("keeps the held order of the rows it had, with new rows after them", () => {
    const sortable = { name: (item: Item) => item.name };
    const items = [makeItem("b"), makeItem("a"), makeItem("c")];
    const { rerender } = renderTable({ items, sortable, holdOrder: true });

    expect(lastIds()).toEqual(["a", "b", "c"]);

    // "aa" sorts before "b", but it is new, so it comes after the held rows.
    rerender({ items: [...items, makeItem("aa")], sortable, holdOrder: true });
    expect(lastIds()).toEqual(["a", "b", "c", "aa"]);

    rerender({ items: [...items, makeItem("aa")], sortable, holdOrder: false });
    expect(lastIds()).toEqual(["a", "aa", "b", "c"]);
  });

  it("adds the extra heights to the rows they name, and keeps the others", () => {
    const items = [makeItem("b"), makeItem("a"), makeItem("c")];
    const extras = observable.map<string, number>();
    const props = {
      items,
      sortable: { name: (item: Item) => item.name },
      rowLineHeight: 10,
      rowPadding: 1,
      extraRowHeights: () => extras,
    };

    renderTable(props);
    expect(lastProps().rowHeights).toEqual([12, 12, 12]);

    act(() => runInAction(() => extras.set("b", 5)));
    expect(lastIds()).toEqual(["a", "b", "c"]);
    expect(lastProps().rowHeights).toEqual([12, 17, 12]);

    act(() => runInAction(() => extras.clear()));
    expect(lastProps().rowHeights).toEqual([12, 12, 12]);
  });
});
