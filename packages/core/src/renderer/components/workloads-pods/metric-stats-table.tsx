/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { bytesToUnits } from "@freelensapp/utilities";
import { formatCpuQuantity } from "../../../common/utils/k8s-quantity";
import { summarizeSeries } from "./metric-stats";
import styles from "./metric-stats-table.module.scss";

import type { ChartDataSets } from "../chart";
import type { MetricsTab } from "../chart/options";

const formatBytes = (value: number) => (value === 0 ? "0" : bytesToUnits(value, { precision: 2 }));

/** How a tab's values read: CPU in cores, the others in bytes, network and disk traffic per second */
export const formatForTab = (tab: MetricsTab, seriesId: string): ((value: number) => string) => {
  if (tab === "CPU") {
    return (value) => (value === 0 ? "0" : formatCpuQuantity(value));
  }

  if (tab === "Network" || /fsReads|fsWrites/.test(seriesId)) {
    return (value) => `${formatBytes(value)}/s`;
  }

  return formatBytes;
};

const isReferenceLine = (dataset: ChartDataSets) => /-(request|limit)$/.test(dataset.id ?? "");

const yValues = (dataset: ChartDataSets) =>
  (dataset.data ?? []).map((point) => (point && typeof point === "object" ? point.y : point));

export interface MetricStatsTableProps {
  tab: MetricsTab;
  datasets: ChartDataSets[] | undefined;
}

/**
 * The minimum, median, 90th percentile and maximum of each series of a chart,
 * over the time range it shows. The request and limit lines are constants and
 * are left out.
 */
export const MetricStatsTable = ({ tab, datasets = [] }: MetricStatsTableProps) => {
  const rows = datasets
    .filter((dataset) => !isReferenceLine(dataset))
    .map((dataset) => ({ dataset, stats: summarizeSeries(yValues(dataset)) }))
    .filter((row) => row.stats !== undefined);

  if (rows.length === 0) {
    return null;
  }

  return (
    <table className={styles.stats} data-testid="metric-stats">
      <thead>
        <tr>
          <th />
          <th>Min</th>
          <th>P50</th>
          <th>P90</th>
          <th>Max</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ dataset, stats }) => {
          const format = formatForTab(tab, dataset.id ?? "");

          return (
            <tr key={dataset.id ?? dataset.label} data-testid={`metric-stats-${dataset.label}`}>
              <td>
                <span className={styles.swatch} style={{ background: dataset.borderColor as string }} />
                {dataset.label}
              </td>
              <td>{format(stats!.min)}</td>
              <td>{format(stats!.p50)}</td>
              <td>{format(stats!.p90)}</td>
              <td>{format(stats!.max)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};
