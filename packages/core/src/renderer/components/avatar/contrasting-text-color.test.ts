/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { contrastingTextColor } from "./avatar";

describe("contrastingTextColor", () => {
  it("is black on a light background and white on a dark one", () => {
    expect(contrastingTextColor("#ffd60a")).toBe("#000000");
    expect(contrastingTextColor("#1e3a8a")).toBe("#ffffff");
    expect(contrastingTextColor("hsl(200, 60%, 30%)")).toBe("#ffffff");
  });

  it("is white for what is not a plain colour", () => {
    expect(contrastingTextColor("var(--primary)")).toBe("#ffffff");
  });
});
