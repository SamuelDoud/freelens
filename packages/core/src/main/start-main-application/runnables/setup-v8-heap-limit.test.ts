/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { getHeapLimitMegabytes, withHeapLimit } from "./setup-v8-heap-limit";

const gib = 1024 ** 3;

describe("getHeapLimitMegabytes", () => {
  it.each([
    [2, 2048],
    [4, 2048],
    [6, 3072],
    [8, 4096],
    [16, 4096],
    [128, 4096],
  ])("for %i GiB of memory is %i MB", (memoryGib, expected) => {
    expect(getHeapLimitMegabytes(memoryGib * gib)).toBe(expected);
  });
});

describe("withHeapLimit", () => {
  it("adds the limit to no flags", () => {
    expect(withHeapLimit("", 16 * gib)).toBe("--max-old-space-size=4096");
  });

  it("keeps the flags that are there", () => {
    expect(withHeapLimit("--expose-gc", 16 * gib)).toBe("--expose-gc --max-old-space-size=4096");
  });

  it("leaves a limit the user set alone", () => {
    expect(withHeapLimit("--max-old-space-size=1024", 16 * gib)).toBe("--max-old-space-size=1024");
    expect(withHeapLimit("--max_old_space_size=1024", 16 * gib)).toBe("--max_old_space_size=1024");
  });
});
