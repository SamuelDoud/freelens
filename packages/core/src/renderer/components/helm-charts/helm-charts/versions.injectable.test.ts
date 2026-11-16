/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { getDiForUnitTesting } from "../../../getDiForUnitTesting";
import { toHelmRelease } from "../../helm-releases/to-helm-release";
import helmChartVersionsInjectable from "./versions.injectable";

import type { ListedHelmRelease } from "../../../../features/helm-releases/common/channels";

const release = (chart: string) =>
  toHelmRelease({
    name: "r",
    namespace: "ns",
    revision: "1",
    status: "deployed",
    chart,
    app_version: "1",
    updated: "2024-01-01 10:00:00 +0000 UTC",
  } as ListedHelmRelease);

describe("helm-chart-versions-loader", () => {
  it("is not shared between two charts of the same release", () => {
    const di = getDiForUnitTesting();

    expect(di.inject(helmChartVersionsInjectable, release("a-1.0.0"))).not.toBe(
      di.inject(helmChartVersionsInjectable, release("b-1.0.0")),
    );
  });

  it("is shared between two revisions of the same chart", () => {
    const di = getDiForUnitTesting();

    expect(di.inject(helmChartVersionsInjectable, release("a-1.0.0"))).toBe(
      di.inject(helmChartVersionsInjectable, release("a-1.1.0")),
    );
  });
});
