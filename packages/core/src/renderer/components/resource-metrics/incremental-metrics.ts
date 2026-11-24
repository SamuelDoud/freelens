/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { calculateAdaptiveStep } from "../../../common/k8s-api/endpoints/metrics.api/adaptive-step";

import type { MetricData, MetricResult } from "../../../common/k8s-api/endpoints/metrics.api";

/** The metrics of one request: one `MetricData` per name. */
export type MetricSet = Partial<Record<string, MetricData>>;

export interface IncrementalWindow {
  start: number;
  end: number;
  range: number;
  /** Set on the requests for the end of the window only: the step of the whole window */
  step?: number;
}

export interface IncrementalMetricsOptions<Value extends MetricSet> {
  /** One request for the window; it must pass `step` on to the metrics API when it is set */
  request: (window: IncrementalWindow) => Promise<Value>;

  /** Every how many polls the whole window is fetched again, to pick up revised history */
  fullRefetchEvery?: number;
}

export interface IncrementalFetchParams {
  start: number;
  end: number;
  range: number;

  /**
   * Whether the window slides with the clock. Only a sliding window is fetched
   * incrementally: the end of a custom range does not move, and its start is
   * the user's, so there is nothing to append to.
   */
  sliding: boolean;

  /** Whatever else the request depends on; when it changes the whole window is fetched */
  key?: string;
}

export interface IncrementalMetrics<Value extends MetricSet> {
  fetch: (params: IncrementalFetchParams) => Promise<Value>;
  reset: () => void;
}

export const defaultFullRefetchEvery = 10;

/** How far before the last point an incremental query starts, in seconds */
const lateSampleSeconds = 5 * 60;

interface State<Value extends MetricSet> {
  /** A point of the grid; every point of every query is `anchor` plus a whole number of steps */
  anchor: number;
  step: number;
  key: string;
  data: Value;
  polls: number;
}

const seriesId = (result: MetricResult) =>
  JSON.stringify(Object.entries(result.metric ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

const isCacheable = (data: MetricSet): boolean =>
  typeof data === "object" &&
  data !== null &&
  Object.keys(data).length > 0 &&
  Object.values(data).every((metric) => {
    if (metric === undefined) {
      return false;
    }

    if (metric.data?.resultType !== "matrix" || !Array.isArray(metric.data.result)) {
      return false;
    }

    const ids = new Set(metric.data.result.map(seriesId));

    return ids.size === metric.data.result.length && metric.data.result.every((series) => Array.isArray(series.values));
  });

const lastTimestamp = (data: MetricSet): number | undefined => {
  let last: number | undefined;

  for (const metric of Object.values(data)) {
    for (const series of metric?.data.result ?? []) {
      const point = series.values[series.values.length - 1];

      if (point && (last === undefined || point[0] > last)) {
        last = point[0];
      }
    }
  }

  return last;
};

/**
 * Merges the points of a query for the end of a window into the points held
 * for the window, or returns undefined when the answer does not fit them (a
 * series or a metric that was not there, so that the whole window has to be
 * fetched again).
 */
const merge = <Value extends MetricSet>(
  held: Value,
  fresh: Value,
  windowStart: number,
  from: number,
): Value | undefined => {
  const heldKeys = Object.keys(held);
  const freshKeys = Object.keys(fresh);

  if (heldKeys.length !== freshKeys.length || !isCacheable(fresh)) {
    return undefined;
  }

  const merged: MetricSet = {};

  for (const key of heldKeys) {
    const heldMetric = held[key];
    const freshMetric = fresh[key];

    if (!heldMetric || !freshMetric) {
      return undefined;
    }

    const heldIds = new Set(heldMetric.data.result.map(seriesId));
    const freshById = new Map(freshMetric.data.result.map((series) => [seriesId(series), series]));

    for (const id of freshById.keys()) {
      if (!heldIds.has(id)) {
        return undefined;
      }
    }

    const result: MetricResult[] = [];

    for (const series of heldMetric.data.result) {
      const values = series.values.filter(([timestamp]) => timestamp >= windowStart && timestamp < from);
      const appended = freshById.get(seriesId(series))?.values ?? [];

      for (const point of appended) {
        if (point[0] >= windowStart) {
          values.push(point);
        }
      }

      if (values.length > 0) {
        result.push({ ...series, values });
      }
    }

    merged[key] = { ...freshMetric, data: { ...freshMetric.data, result } };
  }

  return merged as Value;
};

/**
 * Fetches the metrics of a sliding window by asking only for what is new.
 *
 * The first request, and every one after the range, the key or the step change,
 * a series appears, or every `fullRefetchEvery` polls, asks for the whole window
 * as before. The ones between ask from a little before the last point held, and
 * append what comes back.
 *
 * Every point lies on one grid, the start of the first whole-window request
 * plus whole steps, and the window is cut at the first grid point at or after
 * its start. A point of an instant query is evaluated at its own timestamp, so it
 * has the same value in whichever request it is, and the result is the one a
 * single request from that grid point would give.
 */
export function createIncrementalMetrics<Value extends MetricSet>({
  request,
  fullRefetchEvery = defaultFullRefetchEvery,
}: IncrementalMetricsOptions<Value>): IncrementalMetrics<Value> {
  let state: State<Value> | undefined;
  let issued = 0;
  let committed = 0;

  const fetchWhole = async (params: IncrementalFetchParams, step: number, id: number): Promise<Value> => {
    const data = await request({ start: params.start, end: params.end, range: params.range });

    if (id > committed) {
      committed = id;
      state =
        params.sliding && isCacheable(data)
          ? { anchor: params.start, step, key: params.key ?? "", data, polls: 0 }
          : undefined;
    }

    return data;
  };

  return {
    reset: () => {
      state = undefined;
      issued += 1;
      committed = issued;
    },

    fetch: async (params) => {
      const id = ++issued;
      const step = calculateAdaptiveStep(params.end - params.start);
      const held = state;

      if (
        !params.sliding ||
        !held ||
        held.step !== step ||
        held.key !== (params.key ?? "") ||
        held.polls + 1 >= fullRefetchEvery ||
        params.start < held.anchor
      ) {
        return fetchWhole(params, step, id);
      }

      const windowStart = held.anchor + Math.ceil((params.start - held.anchor) / step) * step;
      const last = lastTimestamp(held.data);

      if (last === undefined) {
        return fetchWhole(params, step, id);
      }

      const overlap = Math.max(3, Math.ceil(lateSampleSeconds / step) + 1);
      const from = Math.max(windowStart, held.anchor + Math.floor((last - overlap * step - held.anchor) / step) * step);

      if (from > params.end) {
        return fetchWhole(params, step, id);
      }

      const fresh = await request({ start: from, end: params.end, range: params.end - from, step });
      const merged = merge(held.data, fresh, windowStart, from);

      if (!merged) {
        return fetchWhole(params, step, id);
      }

      if (id > committed) {
        committed = id;
        state = { ...held, data: merged, polls: held.polls + 1 };
      }

      return merged;
    },
  };
}
