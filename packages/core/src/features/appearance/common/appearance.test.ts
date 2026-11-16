/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { defaultAppearance, fontStack, readAppearance, storeAppearance } from "./appearance";

describe("appearance preferences", () => {
  it("default what is missing and keep the rest in range", () => {
    expect(readAppearance(undefined)).toEqual(defaultAppearance);
    expect(readAppearance({ windowOpacity: 0, fontSize: 99, dropdownOpacity: "x", fontFamily: " Inter " })).toEqual({
      windowOpacity: 0.3,
      fontFamily: "Inter",
      fontSize: 22,
      dropdownOpacity: 1,
    });
  });

  it("store only what differs from the default", () => {
    expect(storeAppearance(defaultAppearance)).toBeUndefined();
    expect(storeAppearance({ ...defaultAppearance, fontSize: 16 })).toEqual({ fontSize: 16 });
  });

  it("fall back to the default fonts", () => {
    expect(fontStack("")).toBe('"Roboto", "Helvetica", "Arial", sans-serif');
    expect(fontStack('Fira "Sans')).toBe('"Fira Sans", "Roboto", "Helvetica", "Arial", sans-serif');
  });

  it("keep a backslash in a font name from escaping the closing quote", () => {
    expect(fontStack("Fira\\")).toBe('"Fira", "Roboto", "Helvetica", "Arial", sans-serif');
  });
});
