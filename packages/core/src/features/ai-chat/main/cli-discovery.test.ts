/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AiCliDiscovery } from "./cli-discovery";

import type { AiCliHost } from "./cli-host";

describe("AiCliDiscovery", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports a CLI that does not answer as an error with the reason, not as signed out", async () => {
    vi.useFakeTimers();

    const host = {
      label: "this computer",
      connect: async () => {},
      workDir: async () => ({ workDir: "/w", emptyKubeconfig: "/w/k" }),
      resolveCommand: async (name: string) => (name === "codex" ? "/bin/codex" : undefined),
      // A process that never says anything.
      spawn: async () =>
        Object.assign(new EventEmitter(), {
          stdin: new PassThrough(),
          stdout: new PassThrough(),
          stderr: new PassThrough(),
          kill: vi.fn(),
        }),
    } as unknown as AiCliHost;
    const discovery = new AiCliDiscovery({
      host: () => host,
      configuredPaths: () => ({ claude: "", codex: "", muse: "" }),
      logWarn: () => {},
    });
    const refreshed = discovery.refresh();

    await vi.advanceTimersByTimeAsync(20_000);

    const { codex } = await refreshed;

    expect(codex.state).toBe("error");
    expect(codex.error).toMatch(/did not answer/);
    expect(codex.signedIn).toBeUndefined();
  });
});
