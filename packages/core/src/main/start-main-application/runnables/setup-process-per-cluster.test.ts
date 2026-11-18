/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import {
  clusterOriginsPattern,
  readProcessPerClusterPreference,
  withClusterOriginsIsolated,
} from "./setup-process-per-cluster";

describe("withClusterOriginsIsolated", () => {
  it("is the pattern alone when nothing is set", () => {
    expect(withClusterOriginsIsolated("")).toBe(clusterOriginsPattern);
  });

  it("keeps the origins the user passed", () => {
    expect(withClusterOriginsIsolated("https://a.example, https://b.example")).toBe(
      `https://a.example,https://b.example,${clusterOriginsPattern}`,
    );
  });

  it("does not add the pattern twice", () => {
    expect(withClusterOriginsIsolated(`https://a.example,${clusterOriginsPattern}`)).toBe(
      `https://a.example,${clusterOriginsPattern}`,
    );
  });
});

describe("readProcessPerClusterPreference", () => {
  it("is on without a store, without the preference and when the store cannot be read", () => {
    expect(readProcessPerClusterPreference(() => undefined)).toBe(true);
    expect(readProcessPerClusterPreference(() => ({ preferences: {} }))).toBe(true);
    expect(
      readProcessPerClusterPreference(() => {
        throw new Error("ENOENT");
      }),
    ).toBe(true);
  });

  it("is off only when the store says false", () => {
    expect(readProcessPerClusterPreference(() => ({ preferences: { processPerCluster: false } }))).toBe(false);
    expect(readProcessPerClusterPreference(() => ({ preferences: { processPerCluster: true } }))).toBe(true);
    expect(readProcessPerClusterPreference(() => ({ preferences: { processPerCluster: "no" } }))).toBe(true);
  });
});
