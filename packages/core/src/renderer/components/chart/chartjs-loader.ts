/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

// Chart.js is large and most sessions show no chart before the user opens a
// view that has one, so the renderer loads it when the first chart mounts. It
// is not part of the extension API: extensions get the `Chart` component, which
// loads the library itself, so there is no synchronous reader to serve.

import type { Chart as ChartJS, ChartType, TooltipPositionerFunction } from "chart.js";

// Custom tooltip positioner that places the tooltip at the cursor position.
// Used by both the bar and pie charts via `position: "cursor"`.
declare module "chart.js" {
  interface TooltipPositionerMap {
    cursor: TooltipPositionerFunction<ChartType>;
  }
}

export type ChartJSConstructor = typeof ChartJS;

let loadedChartJs: ChartJSConstructor | undefined;
let pendingChartJs: Promise<ChartJSConstructor> | undefined;

/** The Chart.js constructor if it has been loaded, otherwise `undefined`. */
export const getLoadedChartJs = (): ChartJSConstructor | undefined => loadedChartJs;

/** Loads Chart.js on first call; later calls share the same promise. */
export const loadChartJs = (): Promise<ChartJSConstructor> => {
  pendingChartJs ??= (async () => {
    const [{ Chart, registerables, Tooltip }] = await Promise.all([
      import("chart.js"),
      import("./chartjs-adapter-native"),
    ]);

    // Register all controllers, elements, scales and plugins once. Individual
    // tree-shaken registrations can be a later optimization.
    Chart.register(...registerables);
    Tooltip.positioners.cursor = (_elements, eventPosition) => eventPosition;
    loadedChartJs = Chart;

    return Chart;
  })();

  // A failed load must not poison later attempts.
  pendingChartJs.catch(() => {
    pendingChartJs = undefined;
  });

  return pendingChartJs;
};
