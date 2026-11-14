/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { diffLines } from "./diff-lines";

describe("diffLines", () => {
  it("marks what only one side has", () => {
    expect(diffLines(["a", "b", "c"], ["a", "x", "c", "d"])).toEqual([
      { kind: "same", text: "a" },
      { kind: "removed", text: "b" },
      { kind: "added", text: "x" },
      { kind: "same", text: "c" },
      { kind: "added", text: "d" },
    ]);
  });

  it("handles empty sides", () => {
    expect(diffLines([], ["a"])).toEqual([{ kind: "added", text: "a" }]);
    expect(diffLines(["a"], [])).toEqual([{ kind: "removed", text: "a" }]);
  });
});
