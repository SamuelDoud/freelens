/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { macOsPollingInterval, watchOptionsFor } from "./watch.injectable";

describe("watchOptionsFor", () => {
  it("polls on macOS, where a kqueue watch that cannot be re-armed aborts the process", () => {
    expect(watchOptionsFor("darwin", { depth: 0, usePolling: false, ignoreInitial: true })).toEqual({
      depth: 0,
      ignoreInitial: true,
      usePolling: true,
      interval: macOsPollingInterval,
      binaryInterval: macOsPollingInterval,
    });
    expect(watchOptionsFor("darwin")).toEqual({
      usePolling: true,
      interval: macOsPollingInterval,
      binaryInterval: macOsPollingInterval,
    });
  });

  it("keeps a caller's own polling interval on macOS", () => {
    expect(watchOptionsFor("darwin", { interval: 250 })).toMatchObject({ usePolling: true, interval: 250 });
  });

  it("leaves the options alone on the other platforms", () => {
    const options = { depth: 1, usePolling: false };

    expect(watchOptionsFor("linux", options)).toBe(options);
    expect(watchOptionsFor("win32", options)).toBe(options);
    expect(watchOptionsFor("linux")).toBeUndefined();
  });
});
