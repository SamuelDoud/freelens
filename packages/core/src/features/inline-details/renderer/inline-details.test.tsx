/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { ConfigMap, Node, Pod } from "@freelensapp/kube-object";
import "@testing-library/jest-dom/vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { computed, observable, runInAction } from "mobx";
import { Observer } from "mobx-react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import customResourceDefinitionStoreInjectable from "../../../renderer/components/custom-resource-definitions/store.injectable";
import discoveredCustomResourcesInjectable from "../../../renderer/components/custom-resources/discovered-custom-resources.injectable";
import { NonInjectedItemListLayoutContent } from "../../../renderer/components/item-object-list/content";
import kubeObjectDetailItemsInjectable from "../../../renderer/components/kube-object-details/kube-object-detail-items/kube-object-detail-items.injectable";
import { NodeDetails } from "../../../renderer/components/nodes/details";
import { Table, TableRow } from "../../../renderer/components/table";
import { renderFor } from "../../../renderer/components/test-utils/renderFor";
import { PodDetails } from "../../../renderer/components/workloads-pods/pod-details";
import { getDiForUnitTesting } from "../../../renderer/getDiForUnitTesting";
import { ExpandedRows } from "./expanded-rows";

import type { ItemObject } from "@freelensapp/list-layout";

import type { ItemListLayoutContentProps } from "../../../renderer/components/item-object-list/content";
import type { DiRender } from "../../../renderer/components/test-utils/renderFor";

const makeItem = (id: string): ItemObject => ({ getId: () => id, getName: () => `name-${id}` });

describe("details under the rows of a list", () => {
  let render: DiRender;
  let rows: ExpandedRows;
  let onDetails: ReturnType<typeof vi.fn>;
  let rowClickExpands: boolean;

  const renderRow = (item: ItemObject) => {
    const component = new NonInjectedItemListLayoutContent({
      getFilters: () => [],
      className: "",
      tableId: "pods",
      getItems: () => [item],
      store: { isSelected: () => false, toggleSelection: () => {} },
      getIsReady: () => true,
      renderTableContents: (row: ItemObject) => [row.getName()],
      columnResizeStorage: { get: () => ({}) },
      isTableColumnHidden: vi.fn(),
      hasDetailsView: true,
      onDetails,
      inlineDetails: {
        render: (row: ItemObject) => <div data-testid="details-content">{`details of ${row.getName()}`}</div>,
        rowClickExpands: () => rowClickExpands,
      },
      getExpandedRows: () => rows,
    } as unknown as ConstructorParameters<typeof NonInjectedItemListLayoutContent>[0] &
      ItemListLayoutContentProps<ItemObject, boolean>);

    render(<Observer>{() => component.getTableRow(item)}</Observer>);
  };

  beforeEach(() => {
    render = renderFor(getDiForUnitTesting());
    rows = new ExpandedRows({ now: () => 0, requestFrame: () => undefined, reducedMotion: () => true });
    onDetails = vi.fn();
    rowClickExpands = true;
  });

  it("opens the details under the row on a click on it, and not the side panel", () => {
    renderRow(makeItem("a"));

    fireEvent.click(screen.getByText("name-a"));

    expect(screen.getByTestId("details-content")).toHaveTextContent("details of name-a");
    expect(screen.getByTestId("inline-details-toggle-a")).toHaveAttribute("aria-expanded", "true");
    expect(onDetails).not.toHaveBeenCalled();
  });

  it("opens the side panel on a click on the row when the preferences say so", () => {
    rowClickExpands = false;
    renderRow(makeItem("a"));

    fireEvent.click(screen.getByText("name-a"));

    expect(onDetails).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("details-content")).not.toBeInTheDocument();
  });

  it("opens and closes the details with the arrow, whatever a click on the row does", () => {
    rowClickExpands = false;
    renderRow(makeItem("a"));

    fireEvent.click(screen.getByTestId("inline-details-toggle-a"));

    expect(screen.getByTestId("details-content")).toBeInTheDocument();
    expect(onDetails).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("inline-details-toggle-a"));

    expect(screen.queryByTestId("details-content")).not.toBeInTheDocument();
  });

  it("opens the side panel with the button at the right of the row, leaving the row as it is", () => {
    renderRow(makeItem("a"));

    fireEvent.click(screen.getByTestId("open-side-panel-a"));

    expect(onDetails).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("details-content")).not.toBeInTheDocument();
  });

  it("keeps the details open on a click inside them", () => {
    renderRow(makeItem("a"));
    fireEvent.click(screen.getByText("name-a"));

    fireEvent.click(screen.getByTestId("details-content"));

    expect(screen.getByTestId("details-content")).toBeInTheDocument();
  });
});

describe("the order of a table while its rows are open", () => {
  interface Row extends ItemObject {
    rank: number;
  }

  const row = (id: string, rank: number): Row => ({ getId: () => id, getName: () => id, rank });
  const order = () => screen.getAllByText(/^[a-z]$/).map((element) => element.textContent);

  it("keeps the rows in place while held, puts new rows after them, and sorts again once released", () => {
    const render = renderFor(getDiForUnitTesting());
    const state = observable({ items: [row("a", 1), row("b", 2), row("c", 3)], hold: true }, {}, { deep: false });

    render(
      <Observer>
        {() => (
          <Table<Row>
            tableId="held-order-test"
            items={state.items}
            sortable={{ rank: (item) => item.rank }}
            sortByDefault={{ sortBy: "rank", orderBy: "asc" }}
            sortSyncWithUrl={false}
            holdOrder={state.hold}
            renderRow={(item) => (
              <TableRow key={item.getId()} sortItem={item}>
                {item.getId()}
              </TableRow>
            )}
          />
        )}
      </Observer>,
    );

    expect(order()).toEqual(["a", "b", "c"]);

    // "c" now sorts first, and a new "d" before everything.
    act(() =>
      runInAction(() => {
        state.items = [row("a", 5), row("b", 2), row("c", 1), row("d", 0)];
      }),
    );

    expect(order()).toEqual(["a", "b", "c", "d"]);

    act(() =>
      runInAction(() => {
        state.hold = false;
      }),
    );

    expect(order()).toEqual(["d", "c", "b", "a"]);
  });
});

describe("the detail items of an object", () => {
  const metadata = (kind: string) => ({
    name: `some-${kind}`,
    resourceVersion: "1",
    selfLink: `/api/v1/${kind}/some`,
    uid: `uid-${kind}`,
  });

  it("are the ones for its kind, for any object rather than only the one in the side panel", () => {
    const di = getDiForUnitTesting();

    // The custom resources' item asks the cluster frame's stores, which a unit test has not.
    di.override(customResourceDefinitionStoreInjectable, () => ({ getByObject: () => undefined }) as never);
    di.override(discoveredCustomResourcesInjectable, () => computed(() => []) as never);

    const getDetailItems = di.inject(kubeObjectDetailItemsInjectable);
    const pod = new Pod({
      apiVersion: "v1",
      kind: "Pod",
      metadata: { ...metadata("pod"), namespace: "default" },
      spec: { containers: [] },
      status: {},
    } as never);
    const node = new Node({ apiVersion: "v1", kind: "Node", metadata: metadata("node") } as never);
    const configMap = new ConfigMap({
      apiVersion: "v1",
      kind: "ConfigMap",
      metadata: { ...metadata("configmap"), namespace: "default" },
    } as never);

    expect(getDetailItems(pod)).toContain(PodDetails);
    expect(getDetailItems(pod)).not.toContain(NodeDetails);
    expect(getDetailItems(node)).toContain(NodeDetails);
    expect(getDetailItems(node)).not.toContain(PodDetails);
    expect(getDetailItems(configMap)).not.toContain(PodDetails);
    // Every object gets at least the metadata and the events.
    expect(getDetailItems(configMap).length).toBeGreaterThanOrEqual(2);
  });
});
