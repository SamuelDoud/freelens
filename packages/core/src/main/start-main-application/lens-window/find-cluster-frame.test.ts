/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { findClusterFrame } from "./find-cluster-frame";

import type { ClusterFrameInfo } from "../../../common/cluster-frames.injectable";

const frames = new Map<string, ClusterFrameInfo>([
  ["a", { frameId: 8, processId: 7 }],
  ["b", { frameId: 8, processId: 9 }],
  ["c", { frameId: 5, processId: 10 }],
]);

describe("findClusterFrame", () => {
  it("finds the only frame with the id", () => {
    expect(findClusterFrame(frames, 5, undefined)).toEqual({ frameId: 5, processId: 10 });
  });

  it("finds nothing for an unknown id or none", () => {
    expect(findClusterFrame(frames, 99, ["a"])).toBeUndefined();
    expect(findClusterFrame(frames, undefined, ["a"])).toBeUndefined();
  });

  it("takes the shown one of frames with the same id in different processes", () => {
    expect(findClusterFrame(frames, 8, ["b"])).toEqual({ frameId: 8, processId: 9 });
  });

  it("takes the first when none of them is shown, or nothing is known of what is shown", () => {
    expect(findClusterFrame(frames, 8, ["c"])).toEqual({ frameId: 8, processId: 7 });
    expect(findClusterFrame(frames, 8, undefined)).toEqual({ frameId: 8, processId: 7 });
  });
});
