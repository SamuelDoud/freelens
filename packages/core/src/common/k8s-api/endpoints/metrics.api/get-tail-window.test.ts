/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { getTailWindow } from "./get-tail-window";
import { calculateAdaptiveStep } from "./request-metrics.injectable";

// The points a range query returns: the start and every step after it, up to the end.
function lastPointOf(start: number, end: number, step: number): number {
  return start + Math.floor((end - start) / step) * step;
}

describe("getTailWindow", () => {
  it("keeps the last point of every range, on the grid of the range, with the step of the range", () => {
    let state = 1;
    const random = (limit: number) => {
      state = (state * 1664525 + 1013904223) >>> 0;

      return state % limit;
    };
    const ranges = [300, 1800, 3600, 7200, 14400, 86400, 4 * 86400, 14 * 86400, 30 * 86400, 60 * 86400];

    for (let round = 0; round < 2000; round += 1) {
      const end = 1_700_000_000 + random(1_000_000);
      // Presets, and custom ranges of any length in seconds.
      const length = round % 2 === 0 ? ranges[random(ranges.length)] : 60 + random(40 * 86400);
      const start = end - length;
      const step = calculateAdaptiveStep(length);
      const tail = getTailWindow(start, end);

      if (!tail) {
        continue;
      }

      expect(tail.step).toBe(step);
      expect(tail.end).toBe(end);
      expect(tail.start).toBeGreaterThan(start);
      expect((tail.start - start) % step).toBe(0);
      expect(lastPointOf(tail.start, tail.end, tail.step)).toBe(lastPointOf(start, end, step));
      // It reaches back over the lookback of an instant query.
      expect(tail.end - tail.start).toBeGreaterThanOrEqual(Math.min(300, length));
    }
  });

  it("asks for the whole range when it is not longer than the tail", () => {
    expect(getTailWindow(0, 300)).toBeUndefined();
    expect(getTailWindow(100, 200)).toBeUndefined();
  });
});
