/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { toHelmRelease } from "./to-helm-release";

import type { ListedHelmRelease } from "../../../features/helm-releases/common/channels";

const release = (chart: string) =>
  toHelmRelease({
    name: "r",
    namespace: "ns",
    revision: "1",
    status: "deployed",
    chart,
    app_version: "1",
    updated: "2024-01-01 10:00:00.1 +0000 UTC",
  } as ListedHelmRelease);

describe("toHelmRelease().getChart", () => {
  it.each([
    ["nginx-1.2.3", "nginx"],
    ["nginx-1.2.3-rc.1", "nginx"],
    ["cert-manager-v1.14.0", "cert-manager"],
    ["rancher-2.8.0+up2.8.0", "rancher"],
    ["app-1.2.3+20240101", "app"],
  ])("takes the version off %s", (chart, name) => {
    expect(release(chart).getChart()).toBe(name);
    expect(release(chart).getChart(true)).toBe(chart);
  });
});
