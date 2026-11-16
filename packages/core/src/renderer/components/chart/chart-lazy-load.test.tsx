/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Chart, when Chart.js has not been loaded yet", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
      const target = {
        canvas: this,
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
      });
    } as unknown as typeof HTMLCanvasElement.prototype.getContext);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates the chart once the library has loaded, and not before", async () => {
    const { getLoadedChartJs } = await import("./chartjs-loader");
    const { Chart, ChartKind } = await import("./chart");

    expect(getLoadedChartJs()).toBeUndefined();

    const result = render(
      <Chart type={ChartKind.DOUGHNUT} data={{ datasets: [{ id: "a", data: [1, 2] }] }} showLegend={false} />,
    );
    const canvas = result.container.querySelector("canvas")!;

    expect(getLoadedChartJs()).toBeUndefined();

    await waitFor(() => expect(getLoadedChartJs()?.getChart(canvas)).toBeDefined());
    expect(getLoadedChartJs()?.getChart(canvas)?.data.datasets[0].data).toEqual([1, 2]);
  });

  it("creates no chart for a chart that was unmounted while the library loaded", async () => {
    const { getLoadedChartJs, loadChartJs } = await import("./chartjs-loader");
    const { Chart, ChartKind } = await import("./chart");
    const result = render(<Chart type={ChartKind.DOUGHNUT} data={{ datasets: [] }} showLegend={false} />);
    const canvas = result.container.querySelector("canvas")!;

    result.unmount();
    await loadChartJs();
    await Promise.resolve();

    expect(getLoadedChartJs()?.getChart(canvas)).toBeUndefined();
  });
});
