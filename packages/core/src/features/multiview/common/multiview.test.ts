/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { paneRects, readMultiViews, removedClusterIds } from "./multiview";

describe("paneRects", () => {
  it("puts panes side by side, stacked or in a grid", () => {
    expect(paneRects(2, "columns")).toEqual([
      { left: 0, top: 0, width: 50, height: 100 },
      { left: 50, top: 0, width: 50, height: 100 },
    ]);
    expect(paneRects(2, "rows")).toEqual([
      { left: 0, top: 0, width: 100, height: 50 },
      { left: 0, top: 50, width: 100, height: 50 },
    ]);
    expect(paneRects(3, "grid")).toEqual([
      { left: 0, top: 0, width: 50, height: 50 },
      { left: 50, top: 0, width: 50, height: 50 },
      { left: 0, top: 50, width: 100, height: 50 },
    ]);
  });
});

describe("readMultiViews", () => {
  it("keeps the well-formed ones", () => {
    expect(
      readMultiViews([
        { id: "a", name: "Prod", clusterIds: ["c1", 2, "c2"], layout: "rows", iconText: "PRD" },
        { id: "b", name: "Bad layout", clusterIds: [], layout: "spiral" },
        { name: "No id" },
        "junk",
      ]),
    ).toEqual([
      { id: "a", name: "Prod", clusterIds: ["c1", "c2"], layout: "rows", iconText: "PRD" },
      { id: "b", name: "Bad layout", clusterIds: [], layout: "columns" },
    ]);
  });
});

describe("removedClusterIds", () => {
  it("lists the clusters that no longer exist, in order", () => {
    expect(removedClusterIds(["a", "gone", "b", "gone2"], ["a", "b", "c"])).toEqual(["gone", "gone2"]);
  });
});
