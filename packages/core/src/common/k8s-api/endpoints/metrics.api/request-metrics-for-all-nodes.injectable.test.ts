/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDiForUnitTesting } from "../../../../renderer/getDiForUnitTesting";
import apiBaseInjectable from "../../api-base.injectable";
import requestMetricsInjectable from "./request-metrics.injectable";
import requestAllNodeMetricsInjectable from "./request-metrics-for-all-nodes.injectable";

describe("requestAllNodeMetrics", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T10:20:37Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks for a short window on the grid of the last hour, ending at the same time with the same step", async () => {
    const post = vi.fn().mockResolvedValue({});
    const di = getDiForUnitTesting();

    di.override(apiBaseInjectable, () => ({ post }) as never);

    // What the nodes list asked for before: the last hour, with no start and end.
    await di.inject(requestMetricsInjectable)({ cpuUsage: { category: "nodes" } });
    await di.inject(requestAllNodeMetricsInjectable)();

    const [, before] = post.mock.calls[0];
    const [, after] = post.mock.calls[1];

    expect(after.query.end).toBe(before.query.end);
    expect(after.query.step).toBe(before.query.step);
    expect(after.query.end - after.query.start).toBeLessThan(before.query.end - before.query.start);
    // Every point of the short window is a point of the hour.
    expect((after.query.start - before.query.start) % before.query.step).toBe(0);
    // It reaches back over the 5 minutes an instant query looks back.
    expect(after.query.end - after.query.start).toBeGreaterThanOrEqual(5 * 60 + after.query.step);
    expect(Object.keys(after.data)).toHaveLength(8);
  });
});
