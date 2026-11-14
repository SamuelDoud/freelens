/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { render } from "@testing-library/react";
import { Chart as ChartJS } from "chart.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Chart, ChartKind } from "./chart";

import type { ChartData } from "./chart";

// jsdom has no canvas: give Chart.js a 2D context whose methods do nothing, so
// that the real library runs its update logic.
function createFakeContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const target = {
    canvas,
    measureText: () => ({ width: 0 }),
    getImageData: () => ({ data: [] }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    getLineDash: () => [],
  } as Record<string | symbol, unknown>;

  return new Proxy(target, {
    get: (object, key) => (key in object ? object[key] : () => {}),
    set: (object, key, value) => {
      object[key] = value;

      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

const usageData = (used: number, free: number, color = "#c93dce"): ChartData => ({
  datasets: [
    { id: "usage", label: "Usage", data: [used, free], backgroundColor: [color, "#333"] },
    { id: "requests", label: "Requests", data: [used / 2, free], backgroundColor: ["#4caf50", "#333"] },
  ],
});

describe("Chart", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
      return createFakeContext(this);
    } as unknown as typeof HTMLCanvasElement.prototype.getContext);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderChart(data: ChartData) {
    const result = render(<Chart type={ChartKind.DOUGHNUT} data={data} showLegend={false} />);
    const canvas = result.container.querySelector("canvas");
    const chart = canvas ? ChartJS.getChart(canvas) : undefined;

    if (!chart) {
      throw new Error("Chart.js did not create a chart");
    }

    return { ...result, chart };
  }

  it("keeps each dataset's Chart.js state across data updates, so it animates from the previous values", () => {
    const { chart, rerender } = renderChart(usageData(2, 8));
    const controllers = chart.data.datasets.map((_, index) => chart.getDatasetMeta(index).controller);
    const arcs = chart.data.datasets.map((_, index) => chart.getDatasetMeta(index).data[0]);

    rerender(<Chart type={ChartKind.DOUGHNUT} data={usageData(5, 5)} showLegend={false} />);

    expect(chart.data.datasets.map((_, index) => chart.getDatasetMeta(index).controller)).toEqual(controllers);
    expect(chart.data.datasets.map((_, index) => chart.getDatasetMeta(index).data[0])).toEqual(arcs);
    expect(chart.data.datasets.map((set) => set.data)).toEqual([
      [5, 5],
      [2.5, 5],
    ]);
  });

  it("applies the other changed fields of a dataset", () => {
    const { chart, rerender } = renderChart(usageData(2, 8));

    rerender(<Chart type={ChartKind.DOUGHNUT} data={usageData(2, 8, "#ff0000")} showLegend={false} />);

    expect(chart.data.datasets[0].backgroundColor).toEqual(["#ff0000", "#333"]);
  });

  it("drops a dataset that is no longer passed", () => {
    const { chart, rerender } = renderChart(usageData(2, 8));
    const [usage] = usageData(3, 7).datasets ?? [];

    rerender(<Chart type={ChartKind.DOUGHNUT} data={{ datasets: [usage] }} showLegend={false} />);

    expect(chart.data.datasets.map((set) => (set as { id?: string }).id)).toEqual(["usage"]);
    expect(chart.data.datasets[0].data).toEqual([3, 7]);
  });
});
