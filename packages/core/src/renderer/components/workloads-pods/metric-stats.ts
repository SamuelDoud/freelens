/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

export interface MetricStats {
  readonly min: number;
  readonly p50: number;
  readonly p90: number;
  readonly max: number;
}

/** The value at or below which `percent` of the sorted values lie (nearest rank) */
const percentile = (sorted: readonly number[], percent: number) =>
  sorted[Math.max(0, Math.ceil((percent / 100) * sorted.length) - 1)];

/** The minimum, median, 90th percentile and maximum of a series, or nothing when it has no values. */
export function summarizeSeries(values: readonly unknown[]): MetricStats | undefined {
  const sorted = values
    .map((value) => (typeof value === "string" ? Number(value) : value))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .sort((a, b) => a - b);

  if (sorted.length === 0) {
    return undefined;
  }

  return {
    min: sorted[0],
    p50: percentile(sorted, 50),
    p90: percentile(sorted, 90),
    max: sorted[sorted.length - 1],
  };
}
