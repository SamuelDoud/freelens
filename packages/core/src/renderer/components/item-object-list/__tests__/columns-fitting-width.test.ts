/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it, vi } from "vitest";
import { getColumnsHiddenForSpace } from "../columns-fitting-width";
import { NonInjectedItemListLayoutContent } from "../content";

import type { TableCellProps } from "@freelensapp/list-layout";

// The pods list in the order of its priorities.
const podHeaders: TableCellProps[] = [
  { id: "name", title: "Name" },
  { id: "warning", title: "" },
  { id: "namespace", title: "Namespace" },
  { id: "containers", title: "Containers" },
  { id: "ports", title: "Ports" },
  { id: "restarts", title: "Restarts" },
  { id: "owners", title: "Controlled By" },
  { id: "age", title: "Age" },
  { id: "status", title: "Status" },
  { id: "logs", title: undefined },
];

const hiddenAt = (width: number | undefined, headers = podHeaders, byUser: string[] = [], extraWidth = 0) => [
  ...getColumnsHiddenForSpace({
    headers,
    width,
    isHiddenByUser: ({ id }) => !!id && byUser.includes(id),
    extraWidth,
  }),
];

describe("getColumnsHiddenForSpace", () => {
  it("hides nothing while the width is not known", () => {
    expect(hiddenAt(undefined)).toEqual([]);
  });

  it("hides nothing at widths where every column fits", () => {
    for (const width of [1920, 1440, 1100, 1010]) {
      expect(hiddenAt(width)).toEqual([]);
    }
  });

  it("drops the lowest priorities first as the table narrows", () => {
    expect(hiddenAt(940)).toEqual(["logs"]);
    expect(hiddenAt(900)).toEqual(["status", "logs"]);
    expect(hiddenAt(800)).toEqual(["age", "status", "logs"]);
    expect(hiddenAt(450)).toEqual(["containers", "ports", "restarts", "owners", "age", "status", "logs"]);
  });

  it("keeps a lower priority column out when a higher one does not fit", () => {
    const headers: TableCellProps[] = [
      { id: "name", title: "Name" },
      { id: "big", title: "Big" },
      { id: "icon", title: undefined },
    ];

    // The icon column would fit by itself, but only after the one before it, which does not.
    expect(hiddenAt(55 + 16 + 15 + 160 + 50, headers)).toEqual(["big", "icon"]);
  });

  it("always shows the name column, however narrow the table is", () => {
    expect(hiddenAt(100)).not.toContain("name");
    expect(hiddenAt(100)).toHaveLength(podHeaders.length - 1);
  });

  it("shows the first column when there is no name column", () => {
    const headers: TableCellProps[] = [
      { id: "message", title: "Message" },
      { id: "type", title: "Type" },
    ];

    expect(hiddenAt(100, headers)).toEqual(["type"]);
  });

  it("does not count the columns the user hides, and never lists them", () => {
    expect(hiddenAt(450, podHeaders, ["warning", "containers", "ports"])).toEqual(["owners", "age", "status", "logs"]);
  });

  it("takes the cells outside the headers off the room", () => {
    expect(hiddenAt(940, podHeaders, [], 0)).toEqual(["logs"]);
    expect(hiddenAt(940, podHeaders, [], 84)).toEqual(["status", "logs"]);
  });

  it("hides a cell that shows with another column together with it", () => {
    const headers: TableCellProps[] = [
      { id: "name", title: "Name" },
      { id: "a", title: "A" },
      { id: "a-extra", title: "A2", showWithColumn: "a" },
      { id: "b", title: "B" },
    ];

    expect(hiddenAt(55 + 16 + 15 + 160 + 180, headers)).toEqual(["b"]);
    expect(hiddenAt(55 + 16 + 15 + 160 + 179, headers)).toEqual(["a", "a-extra", "b"]);
  });

  it("works with the few columns of a small list", () => {
    const headers: TableCellProps[] = [
      { id: "name", title: "Name" },
      { id: "age", title: "Age" },
    ];

    expect(hiddenAt(340, headers)).toEqual([]);
    expect(hiddenAt(330, headers)).toEqual(["age"]);
  });
});

// The pods list as it is by default, in the order of its priorities: the columns the user hides by
// default (IP, node, QoS and the resources) are not in it.
const defaultPodHeaders: TableCellProps[] = [
  { id: "name", title: "Name" },
  { id: "warning", title: "" },
  { id: "namespace", title: "Namespace" },
  { id: "containers", title: "Containers" },
  { id: "ports", title: "Ports" },
  { id: "cpuUsage", title: "CPU" },
  { id: "memoryUsage", title: "Memory" },
  { id: "restarts", title: "Restarts" },
  { id: "owners", title: "Controlled By" },
  { id: "age", title: "Age" },
  { id: "status", title: "Status" },
  { id: "logs", title: undefined },
];
const podKeepOrder = [
  "name",
  "status",
  "namespace",
  "warning",
  "restarts",
  "age",
  "cpuUsage",
  "memoryUsage",
  "node",
  "owners",
  "containers",
  "ports",
  "ip",
  "qos",
  "cpuRequest",
  "cpuLimit",
  "memoryRequest",
  "memoryLimit",
  "logs",
];

describe("getColumnsHiddenForSpace with a keep order", () => {
  // The columns that show, in display order.
  const shownAt = (width: number) => {
    const hidden = getColumnsHiddenForSpace({
      headers: defaultPodHeaders,
      width,
      isHiddenByUser: () => false,
      extraWidth: 56,
      keepOrder: podKeepOrder,
    });

    return defaultPodHeaders.map((header) => header.id!).filter((id) => !hidden.has(id));
  };

  it("keeps the name and the status of a pod in a 450 px table", () => {
    expect(shownAt(450)).toEqual(["name", "status"]);
  });

  it("adds the namespace and the warning icon at 600 px", () => {
    expect(shownAt(600)).toEqual(["name", "warning", "namespace", "status"]);
  });

  it("adds restarts, age and CPU at 800 px, ahead of containers and controlled by", () => {
    expect(shownAt(800)).toEqual(["name", "warning", "namespace", "cpuUsage", "restarts", "age", "status"]);
  });

  it("shows every default column when the table is wide", () => {
    expect(shownAt(1920)).toEqual(defaultPodHeaders.map((header) => header.id));
  });

  it("keeps the display order of the columns it shows", () => {
    const shown = shownAt(800);

    expect(shown).toEqual(defaultPodHeaders.map((header) => header.id!).filter((id) => shown.includes(id)));
  });

  it("ranks the columns a keep order does not name after the ones it names, in display order", () => {
    const headers: TableCellProps[] = [
      { id: "name", title: "Name" },
      { id: "a", title: "A" },
      { id: "b", title: "B" },
      { id: "c", title: "C" },
    ];
    const hidden = getColumnsHiddenForSpace({
      headers,
      width: 86 + 160 + 180,
      isHiddenByUser: () => false,
      keepOrder: ["c"],
    });

    expect([...hidden]).toEqual(["b"]);
  });
});

describe("<ItemListLayoutContent> columns hidden for space", () => {
  const setup = (userHidden: string[] = []) => {
    const isTableColumnHidden = vi.fn(
      (_tableId: string, ...ids: (string | undefined)[]) => !!ids.some((id) => id && userHidden.includes(id)),
    );
    const component = new NonInjectedItemListLayoutContent({
      getFilters: () => [],
      tableId: "pods",
      isConfigurable: true,
      className: "",
      getItems: () => [],
      store: {},
      getIsReady: () => true,
      renderTableContents: () => [],
      renderTableHeader: podHeaders,
      columnResizeStorage: { get: () => ({}) },
      isTableColumnHidden,
    } as unknown as ConstructorParameters<typeof NonInjectedItemListLayoutContent>[0]);

    return component as unknown as {
      setTableWidth(width: number): void;
      hiddenForSpace: ReadonlySet<string>;
      showColumn(header: TableCellProps): boolean;
    };
  };

  it("shows every column the user shows until the table is measured", () => {
    const component = setup();

    expect(component.hiddenForSpace.size).toBe(0);
    expect(podHeaders.every((header) => component.showColumn(header))).toBe(true);
  });

  it("follows the width of the table, not the user's setting", () => {
    const component = setup(["age"]);

    component.setTableWidth(450);
    expect(podHeaders.filter((header) => !component.showColumn(header)).map((header) => header.id)).toEqual([
      "containers",
      "ports",
      "restarts",
      "owners",
      "age",
      "status",
      "logs",
    ]);
    // The user's own choice is not listed as hidden for space.
    expect(component.hiddenForSpace.has("age")).toBe(false);

    component.setTableWidth(1920);
    expect(component.hiddenForSpace.size).toBe(0);
    expect(podHeaders.filter((header) => !component.showColumn(header)).map((header) => header.id)).toEqual(["age"]);
  });
});
