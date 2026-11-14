/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { formatCpuQuantity, formatMemoryQuantity, parseQuantity } from "./k8s-quantity";

describe("parseQuantity", () => {
  it.each([
    ["500m", 0.5],
    ["2", 2],
    ["0.25", 0.25],
    ["1Ki", 1024],
    ["512Mi", 512 * 2 ** 20],
    ["1.5Gi", 1.5 * 2 ** 30],
    ["128M", 128e6],
    ["1e3", 1000],
    ["100n", 100e-9],
  ])("reads %s", (value, expected) => {
    expect(parseQuantity(value)).toBeCloseTo(expected, 12);
  });

  it.each(["", "abc", "5 Gi", "1Xi", "--1"])("refuses %j", (value) => {
    expect(parseQuantity(value)).toBeUndefined();
  });
});

describe("formatting", () => {
  it("writes cores the way Kubernetes does", () => {
    expect(formatCpuQuantity(0.25)).toBe("250m");
    expect(formatCpuQuantity(1.5)).toBe("1.5");
    expect(formatCpuQuantity(2)).toBe("2");
  });

  it("writes bytes with a binary suffix", () => {
    expect(formatMemoryQuantity(512 * 2 ** 20)).toBe("512Mi");
    expect(formatMemoryQuantity(1.5 * 2 ** 30)).toBe("1.5Gi");
    expect(formatMemoryQuantity(1000)).toBe("1000");
  });
});
