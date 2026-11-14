/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { ExpandedRows, expandDurationMs } from "./expanded-rows";

describe("ExpandedRows", () => {
  let time: number;
  let frames: (() => void)[];
  let reducedMotion: boolean;
  let rows: ExpandedRows;

  const runFrames = (milliseconds: number) => {
    time += milliseconds;

    const due = frames;

    frames = [];
    due.forEach((frame) => frame());
  };

  beforeEach(() => {
    time = 0;
    frames = [];
    reducedMotion = false;
    rows = new ExpandedRows({
      now: () => time,
      requestFrame: (callback) => frames.push(callback),
      reducedMotion: () => reducedMotion,
    });
  });

  it("opens several rows at once, each sliding to the height of its details", () => {
    rows.openRow("a");
    rows.openRow("b");
    rows.setMeasured("a", 300);
    rows.setMeasured("b", 100);

    expect(rows.openIds).toEqual(["a", "b"]);
    expect(rows.extraHeight("a")).toBe(0);

    runFrames(expandDurationMs / 2);

    expect(rows.extraHeight("a")).toBeGreaterThan(0);
    expect(rows.extraHeight("a")).toBeLessThan(300);

    runFrames(expandDurationMs);

    expect(rows.extraHeight("a")).toBe(300);
    expect(rows.extraHeight("b")).toBe(100);
  });

  it("keeps a closing row's details in the page until they have slid away", () => {
    rows.openRow("a");
    rows.setMeasured("a", 200);
    runFrames(expandDurationMs);
    runFrames(expandDurationMs);

    rows.toggle("a");

    expect(rows.isOpen("a")).toBe(false);
    expect(rows.isShown("a")).toBe(true);

    runFrames(expandDurationMs);
    runFrames(expandDurationMs);

    expect(rows.isShown("a")).toBe(false);
    expect(rows.extraHeight("a")).toBe(0);
  });

  it("opens and closes at once when the system asks for reduced motion", () => {
    reducedMotion = true;
    rows.openRow("a");
    rows.setMeasured("a", 120);

    expect(rows.extraHeight("a")).toBe(120);

    rows.closeAll();

    expect(rows.isShown("a")).toBe(false);
    expect(frames).toEqual([]);
  });
});
