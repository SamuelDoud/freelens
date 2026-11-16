/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import {
  hiddenFrameEvictionMs,
  hiddenFrameGraceMs,
  hiddenFrameHeapLimitBytes,
  maxHiddenFrames,
  pickFramesToEvict,
} from "./eviction-policy";

import type { HiddenFrame } from "./eviction-policy";

const now = 10_000_000;
const frame = (clusterId: string, hiddenForMs: number, protectedBy: string[] = []): HiddenFrame => ({
  clusterId,
  hiddenSince: now - hiddenForMs,
  protectedBy,
});

describe("pickFramesToEvict", () => {
  it("keeps a frame hidden for less than the limit", () => {
    expect(pickFramesToEvict({ hidden: [frame("a", hiddenFrameEvictionMs - 1)], now })).toEqual([]);
  });

  it("evicts a frame hidden for the limit", () => {
    expect(pickFramesToEvict({ hidden: [frame("a", hiddenFrameEvictionMs)], now })).toEqual(["a"]);
  });

  it("never evicts a protected frame, however old, over the cap or over the heap limit", () => {
    const hidden = [0, 1, 2, 3, 4].map((i) => frame(`p${i}`, hiddenFrameEvictionMs * 10 + i, ["terminal session"]));

    expect(pickFramesToEvict({ hidden, now, heapUsedBytes: hiddenFrameHeapLimitBytes * 4 })).toEqual([]);
  });

  it("evicts the longest hidden above the cap, leaving the newest, after the grace", () => {
    const hidden = Array.from({ length: maxHiddenFrames + 2 }, (_, i) => frame(`f${i}`, hiddenFrameGraceMs + i * 1000));

    // f4 is the longest hidden, then f3
    expect(pickFramesToEvict({ hidden, now })).toEqual(["f4", "f3"]);
  });

  it("does not evict by the cap a frame still in its grace", () => {
    const hidden = Array.from({ length: maxHiddenFrames + 2 }, (_, i) => frame(`f${i}`, hiddenFrameGraceMs - 1 - i));

    expect(pickFramesToEvict({ hidden, now })).toEqual([]);
  });

  it("counts protected frames against the cap", () => {
    const hidden = [
      frame("p1", hiddenFrameGraceMs, ["port forward"]),
      frame("p2", hiddenFrameGraceMs, ["port forward"]),
      frame("p3", hiddenFrameGraceMs, ["port forward"]),
      frame("free", hiddenFrameGraceMs),
    ];

    expect(pickFramesToEvict({ hidden, now })).toEqual(["free"]);
  });

  it("evicts one frame at a time when the heap is over the limit", () => {
    const hidden = [frame("a", hiddenFrameGraceMs + 5), frame("b", hiddenFrameGraceMs + 1)];

    expect(pickFramesToEvict({ hidden, now, heapUsedBytes: hiddenFrameHeapLimitBytes + 1 })).toEqual(["a"]);
    expect(pickFramesToEvict({ hidden, now, heapUsedBytes: hiddenFrameHeapLimitBytes })).toEqual([]);
  });
});
