/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import navigateToWorkloadsOverviewInjectable from "../../common/front-end-routing/routes/cluster/workloads/overview/navigate-to-workloads-overview.injectable";
import { loadChartJs } from "../../renderer/components/chart/chartjs-loader";
import {
  type ApplicationBuilder,
  getApplicationBuilder,
} from "../../renderer/components/test-utils/get-application-builder";

import type { RenderResult } from "@testing-library/react";

describe("workload overview", () => {
  let rendered: RenderResult;
  let builder: ApplicationBuilder;

  // Chart.js loads on the first chart's mount; loaded here, the status charts draw synchronously, as
  // they do once a session has shown one chart.
  beforeAll(async () => {
    await loadChartJs();
  });

  beforeEach(async () => {
    builder = getApplicationBuilder().setEnvironmentToClusterFrame();

    builder.afterWindowStart(() => {
      builder.allowKubeResource({
        apiName: "pods",
        group: "",
      });
    });

    rendered = await builder.render();
  });

  describe("when navigating to workload overview", () => {
    beforeEach(() => {
      builder.navigateWith(navigateToWorkloadsOverviewInjectable);
    });

    it("renders", () => {
      expect(rendered.baseElement).toMatchSnapshot();
    });

    it("shows workload overview", () => {
      expect(rendered.queryByTestId("page-for-workloads-overview")).toBeInTheDocument();
    });

    it("shows pods pie chart", () => {
      expect(rendered.queryByTestId("workload-overview-status-chart-pods")).toBeInTheDocument();
    });
  });
});
