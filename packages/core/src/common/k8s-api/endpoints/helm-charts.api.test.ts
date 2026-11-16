/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { HelmChart } from "./helm-charts.api";

import type { RawHelmChart } from "./helm-charts.api";

const raw = (extra: Partial<RawHelmChart> = {}): RawHelmChart => ({
  apiVersion: "v2",
  name: "nginx",
  version: "1.0.0",
  repo: "bitnami",
  created: "2024-01-01T00:00:00Z",
  ...extra,
});

describe("HelmChart.create", () => {
  it("keeps the app version", () => {
    expect(HelmChart.create(raw({ appVersion: "2.3.4" })).getAppVersion()).toBe("2.3.4");
  });

  it("accepts a maintainer without an email", () => {
    const chart = HelmChart.create(raw({ maintainers: [{ name: "a", url: "https://x" } as never] }), {
      onError: "log",
    });

    expect(chart?.getMaintainers()).toEqual([{ name: "a", url: "https://x" }]);
  });

  it("accepts a bundled dependency with an empty repository and an empty description", () => {
    const chart = HelmChart.create(
      raw({ description: "", dependencies: [{ name: "common", repository: "", version: "1.x.x" }] }),
      { onError: "log" },
    );

    expect(chart?.dependencies).toHaveLength(1);
  });
});
