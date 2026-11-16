/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { metricTabOptions } from "./options";

import type { TooltipItem } from "chart.js";

const cpuLabel = (value: number) => {
  const label = metricTabOptions.CPU.plugins?.tooltip?.callbacks?.label as (item: TooltipItem<"line">) => string;

  return label({ dataset: { label: "Usage" }, parsed: { y: value } } as unknown as TooltipItem<"line">);
};

describe("the CPU tooltip", () => {
  it("writes cores below 100 with two significant digits", () => {
    expect(cpuLabel(0.25)).toBe("Usage: 0.25");
    expect(cpuLabel(12.34)).toBe("Usage: 12");
  });

  it("writes 100 cores or more as a plain number, not an exponent", () => {
    expect(cpuLabel(128)).toBe("Usage: 128");
    expect(cpuLabel(1234.5)).toBe("Usage: 1235");
  });
});

const labelOf = (tab: "Network" | "Filesystem", id: string, value: number) => {
  const label = metricTabOptions[tab].plugins?.tooltip?.callbacks?.label as (item: TooltipItem<"line">) => string;

  return label({ dataset: { label: "Series", id }, parsed: { y: value } } as unknown as TooltipItem<"line">);
};

describe("the tooltips of byte series", () => {
  it("write a rate per second and a size without it", () => {
    expect(labelOf("Network", "p-networkReceive", 2048)).toMatch(/\/s$/);
    expect(labelOf("Filesystem", "fsWrites", 2048)).toMatch(/\/s$/);
    expect(labelOf("Filesystem", "fsUsage", 2048)).not.toMatch(/\/s$/);
  });

  it("write the axis of the network tab per second", () => {
    const callback = metricTabOptions.Network.scales?.y?.ticks?.callback as (value: number) => string;

    expect(callback(2048)).toMatch(/\/s$/);
    expect(callback(0)).toBe("0");
  });
});
