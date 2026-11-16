/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./chart.scss";

import { cssNames } from "@freelensapp/utilities";
import { merge, remove } from "es-toolkit/compat";
import React from "react";
import { Badge } from "../badge";
import { StatusBrick } from "../status-brick";
import { getLoadedChartJs, loadChartJs } from "./chartjs-loader";

import type { Chart as ChartJS, ChartData as ChartJSData, ChartOptions, ChartType, Plugin } from "chart.js";
import type { CSSProperties } from "react";

// The wrapper accepts loosely typed data and casts it to the strict v4
// ChartData at the ChartJS boundary (see renderChart). Chart.js v4 parses data
// internally, so string/number-y point values are tolerated at runtime.
export type ChartDataPoint = number | { x: number | string; y: number | string } | null | undefined;

export interface ChartDataSets {
  id?: string;
  tooltip?: string;
  label?: string;
  data?: ChartDataPoint[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  [key: string]: unknown;
}

export interface ChartData {
  labels?: unknown[];
  datasets?: ChartDataSets[];
  [key: string]: unknown;
}

export interface ChartProps {
  data: ChartData;
  options?: ChartOptions; // Passed to ChartJS instance
  width?: number | string;
  height?: number | string;
  type?: ChartKind;
  showChart?: boolean; // Possible to show legend only if false
  showLegend?: boolean;
  legendPosition?: "bottom";
  legendColors?: string[]; // Hex colors for each of the labels in data object
  plugins?: Plugin[];
  redraw?: boolean; // If true - recreate chart instance with no animation
  title?: string;
  className?: string;
  "data-testid"?: string;
}

export enum ChartKind {
  PIE = "pie",
  BAR = "bar",
  LINE = "line",
  DOUGHNUT = "doughnut",
}

const defaultProps: Partial<ChartProps> = {
  type: ChartKind.DOUGHNUT,
  options: {},
  showChart: true,
  showLegend: true,
  legendPosition: "bottom",
  plugins: [],
  redraw: false,
};

export class Chart extends React.Component<ChartProps> {
  static defaultProps = defaultProps as object;

  private canvas = React.createRef<HTMLCanvasElement>();
  private chart: ChartJS | null = null;
  private unmounted = false;
  private loading = false;
  // ChartJS adds _meta field to any data object passed to it.
  // We clone new data prop into currentChartData to compare props and prevProps
  private currentChartData?: ChartData;

  componentDidMount() {
    const { showChart } = this.props;

    if (showChart) {
      this.renderChart();
    }
  }

  componentDidUpdate() {
    const { showChart, redraw } = this.props;

    if (redraw) {
      this.chart?.destroy();
      this.renderChart();
    } else if (showChart) {
      if (!this.chart) {
        this.renderChart();
      } else {
        this.updateChart();
      }
    }
  }

  componentWillUnmount() {
    this.unmounted = true;
    // Destroy the Chart.js instance so its canvas is released. Without this the
    // instance leaks on unmount and a remount hits "Canvas is already in use"
    // (surfaced by React.StrictMode's mount → unmount → mount double-invoke).
    this.chart?.destroy();
    this.chart = null;
  }

  memoizeDataProps() {
    const { data } = this.props;

    this.currentChartData = {
      ...data,
      datasets:
        data.datasets &&
        data.datasets.map((set) => {
          return {
            ...set,
          };
        }),
    };
  }

  updateChart() {
    const { options } = this.props;

    if (!this.chart) return;

    // Merge into the raw config options, not `this.chart.options` (the resolved
    // options proxy). The proxy exposes Chart.js's internal descriptor keys
    // `_scriptable`/`_indexable` (functions); es-toolkit `merge` would copy them
    // into the options object, and on the next update Chart.js would resolve
    // them as scriptable options and call them, throwing "name.startsWith is not
    // a function". Chart.js v4 removed `helpers.configMerge`, which used to skip
    // these keys.
    this.chart.options = merge(this.chart.config.options ?? {}, options);

    this.memoizeDataProps();

    const datasets = this.chart.config.data.datasets as unknown as ChartDataSets[];
    const nextDatasets: ChartDataSets[] = ((this.currentChartData ??= {}).datasets ??= []);

    // Remove stale datasets if they're not available in nextDatasets
    if (datasets.length > nextDatasets.length) {
      const sets = [...datasets];

      sets.forEach((set) => {
        if (!nextDatasets.find((next) => next.id === set.id)) {
          remove(datasets, (item) => item.id === set.id);
        }
      });
    }

    // Mutating inner chart datasets to enable seamless transitions
    nextDatasets.forEach((next, datasetIndex) => {
      const index = datasets.findIndex((set) => set.id === next.id);

      if (index !== -1) {
        const dataset = datasets[index];
        const data = (dataset.data = (dataset.data ?? []).slice()); // "Clean" mobx observables data to use in ChartJS
        const nextData = (next.data ??= []);

        data.splice(next.data.length);

        for (let dataIndex = 0; dataIndex < nextData.length; dataIndex += 1) {
          data[dataIndex] = nextData[dataIndex];
        }

        // Merge the other fields into the same object. Chart.js keeps a
        // dataset's controller and elements keyed by the dataset object, so a
        // replaced object counts as a new dataset and animates from zero
        // instead of from its previous values.
        const { data: _data, ...props } = next;

        Object.assign(dataset, props);
      } else {
        datasets[datasetIndex] = next;
      }
    });
    this.chart.update();
  }

  renderLegend() {
    if (!this.props.showLegend) return null;
    const { data, legendColors } = this.props;
    const { labels, datasets } = data;
    const labelElem = (
      title: string | undefined,
      color: string | CSSProperties["backgroundColor"],
      tooltip?: string,
    ) => (
      <Badge
        key={title}
        className="LegendBadge flex gap-2 items-center"
        label={
          <div className="flex items-center">
            <StatusBrick style={{ backgroundColor: color }} className="shrink-0" />
            <span>{title}</span>
          </div>
        }
        tooltip={tooltip}
        expandable={false}
      />
    );

    return (
      <div className="legend flex flex-wrap">
        {labels
          ? labels.map((label, index) => {
              const { backgroundColor = [] } = datasets?.[0] ?? {};
              const color = legendColors ? legendColors[index] : (backgroundColor as string[])[index];

              return labelElem(label as string, color);
            })
          : datasets?.map(({ borderColor, label, tooltip }) => labelElem(label, borderColor as string, tooltip))}
      </div>
    );
  }

  renderChart() {
    const { type, options, plugins } = this.props;
    const canvas = this.canvas.current;

    if (!canvas) {
      return;
    }

    const ChartJS = getLoadedChartJs();

    if (!ChartJS) {
      // The first chart of the session: the library loads now, and the chart
      // is created from the props of the moment it arrives.
      if (!this.loading) {
        this.loading = true;
        loadChartJs().then(
          () => {
            this.loading = false;

            if (!this.unmounted && !this.chart && this.props.showChart) {
              this.renderChart();
            }
          },
          () => {
            this.loading = false;
          },
        );
      }

      return;
    }

    this.memoizeDataProps();

    this.chart = new ChartJS(canvas, {
      type: type as ChartType,
      plugins: plugins as Plugin<ChartType>[],
      options: {
        ...options,
        plugins: {
          ...options?.plugins,
          legend: {
            display: false,
          },
        },
      },
      data: this.currentChartData as unknown as ChartJSData,
    });
  }

  render() {
    const { width, height, showChart, title, className, "data-testid": dataTestId } = this.props;

    return (
      <div className={cssNames("Chart", className)} data-testid={dataTestId}>
        {title && <div className="chart-title">{title}</div>}
        {showChart && (
          <div className="chart-container">
            <canvas ref={this.canvas} width={width} height={height} />
            <div className="chartjs-tooltip flex flex-col"></div>
          </div>
        )}
        {this.renderLegend()}
      </div>
    );
  }
}
