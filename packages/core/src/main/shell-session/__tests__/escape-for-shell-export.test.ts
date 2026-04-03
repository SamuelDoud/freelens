/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { escapeForShellExport } from "../open-external-terminal.injectable";

describe("escapeForShellExport", () => {
  it("passes through strings without single quotes", () => {
    expect(escapeForShellExport("/usr/bin/kubectl")).toBe("/usr/bin/kubectl");
  });

  it("escapes a single quote in the middle", () => {
    expect(escapeForShellExport("it's")).toBe("it'\\''s");
  });

  it("escapes multiple single quotes", () => {
    expect(escapeForShellExport("a'b'c")).toBe("a'\\''b'\\''c");
  });

  it("handles empty string", () => {
    expect(escapeForShellExport("")).toBe("");
  });

  it("handles string that is just a single quote", () => {
    expect(escapeForShellExport("'")).toBe("'\\''");
  });

  it("handles paths with spaces", () => {
    expect(escapeForShellExport("/Applications/My App/bin")).toBe("/Applications/My App/bin");
  });

  it("handles paths with spaces and quotes", () => {
    expect(escapeForShellExport("/path/to/it's dir")).toBe("/path/to/it'\\''s dir");
  });
});
