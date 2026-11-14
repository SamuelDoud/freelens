/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { ChartDataSets } from "../chart";

export const requestLineColor = "#f5c518";
export const limitLineColor = "#e5484d";

type Point = { x: number; y: unknown };

/**
 * The flat request (yellow) and limit (red) lines of a usage chart, at the
 * times of its usage points so that a tooltip lists them with the usage.
 * The limit is drawn on top, so it shows when the two are equal; both are
 * drawn over the usage. Chart.js draws a lower `order` later.
 */
export function resourceReferenceLines(
  id: string,
  usage: readonly Point[],
  { request, limit }: { request?: number; limit?: number },
  what: string,
): ChartDataSets[] {
  const flat = (y: number) => usage.map(({ x }) => ({ x, y }));
  const line = { fill: false, borderWidth: 2, pointRadius: 0, pointHoverRadius: 3, tension: 0 };
  const datasets: ChartDataSets[] = [];

  if (request !== undefined) {
    datasets.push({
      ...line,
      id: `${id}-request`,
      label: "Request",
      tooltip: `The ${what} requested`,
      borderColor: requestLineColor,
      data: flat(request),
      order: 1,
    });
  }

  if (limit !== undefined) {
    datasets.push({
      ...line,
      id: `${id}-limit`,
      label: "Limit",
      tooltip: `The ${what} limit`,
      borderColor: limitLineColor,
      data: flat(limit),
      order: 0,
    });
  }

  return datasets;
}
