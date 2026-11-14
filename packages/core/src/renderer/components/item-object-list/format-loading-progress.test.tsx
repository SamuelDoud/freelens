/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { formatLoadingProgress } from "./header";

describe("formatLoadingProgress", () => {
  it("counts items", () => {
    expect(formatLoadingProgress({ loaded: 1200 })).toBe("Loading… 1,200 items");
    expect(formatLoadingProgress({ loaded: 1200, total: 4000 })).toBe("Loading… 1,200 / 4,000 items");
  });

  it("counts the namespaces of a load that lists them one by one", () => {
    expect(formatLoadingProgress({ loaded: 12400, namespaces: { done: 37, total: 40, waitingOn: [] } })).toBe(
      "Loading… 12,400 items · 37 of 40 namespaces",
    );
  });

  it("names the namespaces it waits on", () => {
    expect(
      formatLoadingProgress({ loaded: 5, namespaces: { done: 39, total: 40, waitingOn: ["big-batch-jobs"] } }),
    ).toBe("Loading… 5 items · 39 of 40 namespaces, waiting on namespace big-batch-jobs");
    expect(formatLoadingProgress({ loaded: 5, namespaces: { done: 37, total: 40, waitingOn: ["a", "b", "c"] } })).toBe(
      "Loading… 5 items · 37 of 40 namespaces, waiting on namespaces a, b and c",
    );
  });
});
