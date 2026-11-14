/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { mapValues } from "es-toolkit";
import { toJS } from "mobx";
import { observer } from "mobx-react";
import { useContext } from "react";
import { getItemMetrics, isMetricsEmpty, normalizeMetrics } from "../../../common/k8s-api/endpoints/metrics.api";
import { BarChart } from "../chart";
import { type MetricsTab, metricTabOptions } from "../chart/options";
import selectedMetricsTimeRangeInjectable from "../cluster/overview/selected-metrics-time-range.injectable";
import { ResourceMetricsContext } from "../resource-metrics";
import { NoMetrics } from "../resource-metrics/no-metrics";
import { MetricStatsTable } from "./metric-stats-table";
import { getContainerResources } from "./pod-resources";
import { resourceReferenceLines } from "./resource-reference-lines";

import type { Pod } from "@freelensapp/kube-object";

import type { ChartDataSets } from "../chart";
import type { SelectedMetricsTimeRange } from "../cluster/overview/selected-metrics-time-range.injectable";

export interface ContainerChartsProps {
  containerName: string;
}

interface Dependencies {
  selectedMetricsTimeRange: SelectedMetricsTimeRange;
}

const NonInjectedContainerCharts = observer(
  ({ selectedMetricsTimeRange, containerName }: Dependencies & ContainerChartsProps) => {
    const { metrics, tab, object } = useContext(ResourceMetricsContext) ?? {};
    const { start: minTime, end: maxTime } = selectedMetricsTimeRange.timestamps.get();

    if (!metrics || !object || !tab) return null;
    const selectedContainerMetrics = getItemMetrics(toJS(metrics), containerName);

    if (!selectedContainerMetrics || isMetricsEmpty(selectedContainerMetrics)) return <NoMetrics />;

    const { cpuUsage, memoryUsage, fsUsage, fsWrites, fsReads } = mapValues(
      selectedContainerMetrics,
      (metric) => normalizeMetrics(metric).data.result[0].values,
    );
    const container = (object as Pod).getAllContainers?.().find(({ name }) => name === containerName);
    const resources = container ? getContainerResources(container) : {};

    const datasets: Partial<Record<MetricsTab, ChartDataSets[]>> = {
      CPU: [
        {
          id: "cpuUsage",
          label: `Usage`,
          tooltip: `CPU cores usage`,
          borderColor: "#00a7a0",
          data: cpuUsage.map(([x, y]) => ({ x: x * 1000, y })),
          order: 2,
        },
        ...resourceReferenceLines(
          "cpu",
          cpuUsage.map(([x, y]) => ({ x: x * 1000, y })),
          { request: resources.cpuRequest, limit: resources.cpuLimit },
          "CPU",
        ),
      ],
      Memory: [
        {
          id: "memoryUsage",
          label: `Usage`,
          tooltip: `Memory usage`,
          borderColor: "#c93dce",
          data: memoryUsage.map(([x, y]) => ({ x: x * 1000, y })),
          order: 2,
        },
        ...resourceReferenceLines(
          "memory",
          memoryUsage.map(([x, y]) => ({ x: x * 1000, y })),
          { request: resources.memoryRequest, limit: resources.memoryLimit },
          "memory",
        ),
      ],
      Filesystem: [
        {
          id: "fsUsage",
          label: `Usage`,
          tooltip: `Bytes consumed on this filesystem`,
          borderColor: "#ffc63d",
          data: fsUsage.map(([x, y]) => ({ x: x * 1000, y })),
        },
        {
          id: "fsWrites",
          label: `Writes`,
          tooltip: `Bytes written on this filesystem`,
          borderColor: "#ff963d",
          data: fsWrites.map(([x, y]) => ({ x: x * 1000, y })),
        },
        {
          id: "fsReads",
          label: `Reads`,
          tooltip: `Bytes read on this filesystem`,
          borderColor: "#fff73d",
          data: fsReads.map(([x, y]) => ({ x: x * 1000, y })),
        },
      ],
    };

    return (
      <>
        <BarChart
          lines
          name={`metrics-${tab}`}
          options={metricTabOptions[tab]}
          data={{ datasets: datasets[tab] }}
          minTime={minTime}
          maxTime={maxTime}
        />
        <MetricStatsTable tab={tab} datasets={datasets[tab]} />
      </>
    );
  },
);

export const ContainerCharts = withInjectables<Dependencies, ContainerChartsProps>(NonInjectedContainerCharts, {
  getProps: (di, props) => ({
    ...props,
    selectedMetricsTimeRange: di.inject(selectedMetricsTimeRangeInjectable),
  }),
});
