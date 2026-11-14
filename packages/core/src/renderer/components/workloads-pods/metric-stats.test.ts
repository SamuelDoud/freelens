/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { summarizeSeries } from "./metric-stats";

describe("summarizeSeries", () => {
  it("gives the minimum, median, 90th percentile and maximum", () => {
    const values = Array.from({ length: 10 }, (_, index) => index + 1).reverse();

    expect(summarizeSeries(values)).toEqual({ min: 1, p50: 5, p90: 9, max: 10 });
  });

  it("reads numbers given as text and leaves out what is not a number", () => {
    expect(summarizeSeries(["0.5", null, "NaN", 2, undefined])).toEqual({ min: 0.5, p50: 0.5, p90: 2, max: 2 });
  });

  it("has nothing to say about an empty series", () => {
    expect(summarizeSeries([])).toBeUndefined();
  });
});
