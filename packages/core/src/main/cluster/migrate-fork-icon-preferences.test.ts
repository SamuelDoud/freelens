/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { migrateForkIconPreferences } from "./migrate-fork-icon-preferences";

import type { ClusterPreferences } from "../../common/cluster-types";

const withForkIcon = (preferences: Record<string, unknown>) => preferences as ClusterPreferences;

describe("migrating the fork's cluster icon preferences", () => {
  it("moves the text to the label, at most three characters, and the background to the color", () => {
    const preferences = withForkIcon({ iconText: " prod-eu ", iconBackground: "#ff8800", iconTextColor: "#000000" });

    migrateForkIconPreferences(preferences);

    expect(preferences).toEqual({ iconShortName: "pro", icon: "#ff8800" });
  });

  it("keeps a label and an image already set", () => {
    const preferences = withForkIcon({
      iconText: "abc",
      iconBackground: "#ff8800",
      iconShortName: "XY",
      icon: "data:image/png;base64,AAAA",
    });

    migrateForkIconPreferences(preferences);

    expect(preferences).toEqual({ iconShortName: "XY", icon: "data:image/png;base64,AAAA" });
  });

  it("changes nothing without the fork's preferences", () => {
    const preferences = withForkIcon({ iconShortName: "XY" });

    migrateForkIconPreferences(preferences);

    expect(preferences).toEqual({ iconShortName: "XY" });
  });
});
