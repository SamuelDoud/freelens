/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { AiMuseSessions, choosePermissionOption, parseMuseUpdate } from "./muse-acp";

import type { AiCliHost } from "./cli-host";

const options = [
  { optionId: "allow", kind: "allow_once" },
  { optionId: "always", kind: "allow_always" },
  { optionId: "reject", kind: "reject_once" },
];

describe("parseMuseUpdate", () => {
  it("reads the agent's text chunks and nothing else", () => {
    expect(
      parseMuseUpdate({ update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "Hello" } } }),
    ).toEqual([{ kind: "text", text: "Hello" }]);
    expect(parseMuseUpdate({ update: { sessionUpdate: "tool_call", title: "freelens list_resources" } })).toEqual([]);
    expect(parseMuseUpdate(undefined)).toEqual([]);
  });
});

describe("choosePermissionOption", () => {
  it("allows Freelens's own tools, which enforce Allow changes themselves", () => {
    expect(choosePermissionOption({ options, toolCall: { title: "mcp__freelens__list_resources" } })).toBe("allow");
    expect(choosePermissionOption({ options, toolCall: { name: "mcp__freelens__get_current_view" } })).toBe("allow");
    expect(choosePermissionOption({ options, toolCall: { toolName: "get_pod_logs" } })).toBe("allow");
  });

  it("names the call from its announcement when the request leaves the name out", () => {
    const request = { options, toolCall: { toolCallId: "call-1", title: "", kind: "" } };

    expect(choosePermissionOption(request)).toBe("reject");
    expect(choosePermissionOption(request, { toolCallId: "call-1", title: "mcp__freelens__list_resources" })).toBe(
      "allow",
    );
  });

  it("rejects anything else, including a call that only mentions Freelens", () => {
    expect(choosePermissionOption({ options, toolCall: { title: "web_fetch https://example.com" } })).toBe("reject");
    expect(
      choosePermissionOption({ options, toolCall: { title: "web_fetch https://freelens.app/list_resources" } }),
    ).toBe("reject");
    expect(choosePermissionOption({ options, toolCall: { title: "mcp__other__list_resources" } })).toBe("reject");
  });
});

describe("prepareMuseWorkspace", () => {
  it("writes a repository whose .mcp.json names Freelens's server, with the token behind a variable", async () => {
    const { mkdtempSync, readFileSync, existsSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const path = await import("node:path");
    const { prepareMuseWorkspace } = await import("./muse-acp");
    const { LocalCliHost } = await import("./cli-host");
    const base = mkdtempSync(path.join(tmpdir(), "muse-workspace-test-"));
    const host = new LocalCliHost({ spawn: () => undefined as never, env: () => ({}), platform: process.platform });

    const workspace = await prepareMuseWorkspace(host, base, "chat-1", "http://127.0.0.1:4000/mcp/chat-1");

    expect(existsSync(path.join(workspace, ".git", "HEAD"))).toBe(true);
    expect(JSON.parse(readFileSync(path.join(workspace, ".mcp.json"), "utf8"))).toEqual({
      mcpServers: {
        freelens: {
          type: "http",
          url: "http://127.0.0.1:4000/mcp/chat-1",
          headers: { Authorization: "${FREELENS_MCP_AUTH}" },
        },
      },
    });
  });
});

describe("AiMuseSessions", () => {
  it("lets go of a process whose session could not start, and says why", async () => {
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const child = Object.assign(new EventEmitter(), { stdin, stdout, stderr: new PassThrough(), kill: vi.fn() });

    // Answers the first request, initialize, with an error.
    stdin.on("data", (chunk: Buffer) => {
      const { id } = JSON.parse(chunk.toString().split("\n")[0]);

      stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { message: "unsupported protocol" } })}\n`);
    });

    const host = {
      workDir: async () => ({ workDir: "/w", emptyKubeconfig: "/w/k" }),
      mcpUrl: async (url: string) => url,
      join: (...parts: string[]) => parts.join("/"),
      mkdir: async () => {},
      writeFile: async () => {},
      remove: vi.fn(async () => {}),
      spawn: async () => child,
      label: "this computer",
    } as unknown as AiCliHost;
    const sessions = new AiMuseSessions({ host: () => host, logWarn: () => {} });
    const events: unknown[] = [];

    await sessions.prompt(
      {
        chatId: "c",
        command: "muse",
        prompt: "hi",
        model: "",
        effort: "",
        systemPrompt: "",
        mcpUrl: "http://127.0.0.1:1/mcp/c",
        mcpToken: "t",
      },
      (event) => events.push(event),
    );

    expect(events).toEqual([{ kind: "done", error: "unsupported protocol" }]);
    expect(child.kill).toHaveBeenCalled();
    expect(host.remove).toHaveBeenCalled();
  });
});
