/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { getSecondsFromUnixEpoch } from "../../../utils/date/get-current-date-time";
import requestMetricsInjectable from "./request-metrics.injectable";

import type { MetricData } from "../metrics.api";

export interface NodeMetricData {
  memoryUsage: MetricData;
  workloadMemoryUsage: MetricData;
  memoryCapacity: MetricData;
  memoryAllocatableCapacity: MetricData;
  cpuUsage: MetricData;
  cpuCapacity: MetricData;
  fsUsage: MetricData;
  fsSize: MetricData;
}

// The list of nodes shows the last value of every series. Without a start and
// an end the request covers the last hour (61 points at this step) for that one
// value. The query is evaluated at every step with the same lookback however
// far back the range starts, so the newest point is the same on a short
// window that ends at the same time and starts a whole number of steps earlier,
// which keeps the points on the grid of the hour. The window holds the
// lookback of a Prometheus instant query (5 minutes) and one step.
const stepSeconds = 60;
const tailSeconds = 6 * stepSeconds;

export type RequestAllNodeMetrics = () => Promise<NodeMetricData>;

const requestAllNodeMetricsInjectable = getInjectable({
  id: "request-all-node-metrics",
  instantiate: (di): RequestAllNodeMetrics => {
    const requestMetrics = di.inject(requestMetricsInjectable);

    return () => {
      const opts = { category: "nodes" };
      const end = getSecondsFromUnixEpoch();
      const timeRange = { start: end - tailSeconds, end, step: stepSeconds };

      return requestMetrics(
        {
          memoryUsage: opts,
          workloadMemoryUsage: opts,
          memoryCapacity: opts,
          memoryAllocatableCapacity: opts,
          cpuUsage: opts,
          cpuCapacity: opts,
          fsSize: opts,
          fsUsage: opts,
        },
        timeRange,
      );
    };
  },
});

export default requestAllNodeMetricsInjectable;
