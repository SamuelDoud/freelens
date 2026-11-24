/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { calculateAdaptiveStep } from "./adaptive-step";

/**
 * How far before a point an instant query looks for a sample, in seconds.
 */
const lookbackSeconds = 5 * 60;

/**
 * The part at the end of a range that holds its last point, for the metrics of
 * which only the last point is read. A query is evaluated at every step with
 * the same lookback, whatever the start of the range, so the points of the
 * window have the values they have in the whole range: the window ends at the
 * same time, uses the same step, and starts a whole number of steps after the
 * start of the range, which puts its points on the grid of the range.
 *
 * It reaches back over the lookback and one step, so that the last point is
 * found even when the newest sample is not quite current.
 *
 * @returns the window and its step, or undefined when the range is not longer
 * than that and the whole range is the better request
 */
export function getTailWindow(start: number, end: number): { start: number; end: number; step: number } | undefined {
  const step = calculateAdaptiveStep(end - start);
  const steps = Math.floor((end - start) / step);
  const tailSteps = Math.ceil(lookbackSeconds / step) + 1;

  if (steps <= tailSteps) {
    return undefined;
  }

  return { start: start + (steps - tailSteps) * step, end, step };
}
