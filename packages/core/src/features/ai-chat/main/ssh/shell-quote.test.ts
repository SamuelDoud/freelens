/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { shellCommand, shellQuote } from "./shell-quote";

describe("shellQuote", () => {
  it("leaves plain words alone and quotes the rest", () => {
    expect(shellQuote("claude")).toBe("claude");
    expect(shellQuote("--model=opus")).toBe("--model=opus");
    expect(shellQuote("")).toBe("''");
    expect(shellQuote("it's $HOME `x`")).toBe(`'it'\\''s $HOME \`x\`'`);
  });

  it("round-trips through a real shell", () => {
    const words = ["a b", "it's", "$HOME", "`date`", "\\n", "", '{"json": [1]}', "line\nbreak"];
    const output = execFileSync("/bin/sh", ["-c", `printf '%s\\0' ${shellCommand(words)}`]).toString();

    expect(output.split("\0").slice(0, -1)).toEqual(words);
  });
});
