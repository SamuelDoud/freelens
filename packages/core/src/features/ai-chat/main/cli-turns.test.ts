/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { AiCliTurns } from "./cli-turns";

import type { AiCliEvent } from "../common/cli-events";
import type { AiCliHost } from "./cli-host";
import type { CliTurn } from "./cli-turns";

const turn: CliTurn = {
  chatId: "chat-1",
  provider: "claude",
  command: "claude",
  prompt: "hi",
  model: "",
  effort: "",
  systemPrompt: "",
  mcpUrl: "http://127.0.0.1:1/mcp/chat-1",
  mcpToken: "secret",
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const setup = () => {
  const child = Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: vi.fn(() => {
      child.emit("close", null, "SIGTERM");

      return true;
    }),
  });
  let releaseSpawn: () => void = () => {};
  const spawnGate = new Promise<void>((resolve) => {
    releaseSpawn = resolve;
  });
  const host = {
    label: "host",
    workDir: async () => ({ workDir: "/w", emptyKubeconfig: "/w/k" }),
    mcpUrl: async (url: string) => url,
    join: (...parts: string[]) => parts.join("/"),
    writeFile: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    spawn: vi.fn(async () => {
      await spawnGate;

      return child;
    }),
  } as unknown as AiCliHost;
  const turns = new AiCliTurns({ host: () => host, logInfo: () => {} });
  const events: AiCliEvent[] = [];

  return { child, host, turns, events, releaseSpawn };
};

describe("AiCliTurns", () => {
  it("stops a turn the user stopped while its process was still being started", async () => {
    const { child, turns, events, releaseSpawn } = setup();

    turns.start(turn, (event) => events.push(event));
    await flush();

    turns.stop(turn.chatId);
    releaseSpawn();
    await flush();

    expect(child.kill).toHaveBeenCalled();
    expect(events).toEqual([{ kind: "done", error: "Stopped." }]);
  });

  it("removes the file that holds the token once the process has ended", async () => {
    const { child, host, turns, releaseSpawn } = setup();

    turns.start(turn, () => {});
    releaseSpawn();
    await flush();
    child.emit("close", 0, null);

    expect(host.remove).toHaveBeenCalledWith("/w/mcp-chat-1.json");
  });
});
