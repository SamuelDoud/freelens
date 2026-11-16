/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import { getTailWindow } from "../../../common/k8s-api/endpoints/metrics.api/get-tail-window";
import requestClusterMetricsByNodeNamesInjectable from "../../../common/k8s-api/endpoints/metrics.api/request-cluster-metrics-by-node-names.injectable";
import { asyncComputed } from "../../../common/utils/async-computed";
import { createIncrementalMetrics } from "../resource-metrics/incremental-metrics";
import selectedMetricsTimeRangeInjectable from "./overview/selected-metrics-time-range.injectable";
import selectedNodeRoleForMetricsInjectable from "./overview/selected-node-role-for-metrics.injectable";

import type {
  ClusterMetricData,
  ClusterMetricKey,
} from "../../../common/k8s-api/endpoints/metrics.api/request-cluster-metrics-by-node-names.injectable";

// The series the chart plots over the whole range. Every other metric is read
// at its last point only (the pie charts and the capacity of the chart's axis).
const seriesMetrics: ClusterMetricKey[] = ["cpuUsage", "memoryUsage"];

const lastPointMetrics: ClusterMetricKey[] = [
  "memoryRequests",
  "memoryLimits",
  "memoryCapacity",
  "memoryAllocatableCapacity",
  "cpuRequests",
  "cpuLimits",
  "cpuCapacity",
  "cpuAllocatableCapacity",
  "podUsage",
  "podCapacity",
  "podAllocatableCapacity",
];

const clusterOverviewMetricsInjectable = getInjectable({
  id: "cluster-overview-metrics",
  instantiate: (di) => {
    const requestClusterMetricsByNodeNames = di.inject(requestClusterMetricsByNodeNamesInjectable);
    const selectedNodeRoleForMetrics = di.inject(selectedNodeRoleForMetricsInjectable);
    const selectedMetricsTimeRange = di.inject(selectedMetricsTimeRangeInjectable);

    // The series over the range are fetched for the end of it only once the
    // chart has them (see `createIncrementalMetrics`); the node names are part
    // of what they depend on.
    let nodeNames: string[] = [];
    const incrementalSeries = createIncrementalMetrics<Record<string, never>>({
      request: ({ start, end, range, step }) =>
        requestClusterMetricsByNodeNames(nodeNames, {
          start,
          end,
          range,
          step,
          metrics: seriesMetrics,
        }) as Promise<Record<string, never>>,
    });

    return asyncComputed<Partial<ClusterMetricData> | undefined>({
      getValueFromObservedPromise: async () => {
        // No clock of its own: the time range ticks every minute while it can
        // be seen and follows the clock, and a hidden overview or a custom
        // range asks for the same window again only when that changes.
        // The node name filter is built from the nodes alive right now, while
        // the time range can reach days back: on clusters with node churn the
        // samples of the replaced nodes would be filtered out (see #2409).
        // When the cluster has nodes of a single role the selected role covers
        // every node, so the filter is skipped and the query aggregates the
        // whole cluster over the time range. When both roles are present the
        // filter is kept to honour the Master/Worker choice.
        const bothRolesPresent =
          selectedNodeRoleForMetrics.hasMasterNodes.get() && selectedNodeRoleForMetrics.hasWorkerNodes.get();
        nodeNames = bothRolesPresent ? selectedNodeRoleForMetrics.nodes.get().map((node) => node.getName()) : [];
        const { start, end, range } = selectedMetricsTimeRange.timestamps.get();

        const tail = getTailWindow(start, end);

        if (!tail) {
          return requestClusterMetricsByNodeNames(nodeNames, { start, end, range });
        }

        // Most of the cost of the overview is in the metrics of the pie charts,
        // which read the last point: they are asked for the end of the range.
        const [series, lastPoints] = await Promise.all([
          incrementalSeries.fetch({
            start,
            end,
            range,
            sliding: selectedMetricsTimeRange.value.get().duration != null,
            key: nodeNames.join("|"),
          }) as Promise<Partial<ClusterMetricData>>,
          requestClusterMetricsByNodeNames(nodeNames, {
            start: tail.start,
            end,
            step: tail.step,
            range: end - tail.start,
            metrics: lastPointMetrics,
          }),
        ]);

        return { ...series, ...lastPoints };
      },
      betweenUpdates: "show-latest-value",
    });
  },
  lifecycle: lifecycleEnum.singleton,
});

export default clusterOverviewMetricsInjectable;
