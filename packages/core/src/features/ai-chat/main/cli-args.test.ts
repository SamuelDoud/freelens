/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { buildClaudeArgs, buildClaudeMcpConfig, buildCodexArgs } from "./cli-args";

const turn = {
  prompt: "which pods fail?",
  model: "",
  effort: "",
  systemPrompt: "You are Freelens.",
  mcpUrl: "http://127.0.0.1:4000/mcp/chat-1",
  mcpConfigPath: "/tmp/mcp.json",
};

const valueOf = (args: string[], flag: string) => args[args.indexOf(flag) + 1];

describe("buildClaudeArgs", () => {
  it("takes away every built-in tool and setting, leaving only Freelens's MCP server", () => {
    const args = buildClaudeArgs({ ...turn, newSessionId: "s-new" });

    expect(valueOf(args, "--tools")).toBe("");
    expect(args).toContain("--strict-mcp-config");
    expect(valueOf(args, "--mcp-config")).toBe("/tmp/mcp.json");
    expect(valueOf(args, "--allowed-tools")).toBe("mcp__freelens");
    expect(valueOf(args, "--setting-sources")).toBe("");
    expect(valueOf(args, "--system-prompt")).toBe("You are Freelens.");
    expect(valueOf(args, "--output-format")).toBe("stream-json");
    expect(valueOf(args, "-p")).toBe("which pods fail?");
  });

  it("starts a new session or resumes the chat's one", () => {
    const fresh = buildClaudeArgs({ ...turn, newSessionId: "s-new" });
    const resumed = buildClaudeArgs({ ...turn, resumeSessionId: "s-old", newSessionId: "s-new" });

    expect(valueOf(fresh, "--session-id")).toBe("s-new");
    expect(fresh).not.toContain("--resume");
    expect(valueOf(resumed, "--resume")).toBe("s-old");
    expect(resumed).not.toContain("--session-id");
  });

  it("passes the model and effort only when chosen", () => {
    expect(buildClaudeArgs(turn)).not.toContain("--model");
    expect(buildClaudeArgs(turn)).not.toContain("--effort");

    const args = buildClaudeArgs({ ...turn, model: "opus", effort: "high" });

    expect(valueOf(args, "--model")).toBe("opus");
    expect(valueOf(args, "--effort")).toBe("high");
  });

  it("gives the MCP server's token as a header", () => {
    expect(buildClaudeMcpConfig("http://127.0.0.1:4000/mcp/c", "tok")).toEqual({
      mcpServers: {
        freelens: { type: "http", url: "http://127.0.0.1:4000/mcp/c", headers: { Authorization: "Bearer tok" } },
      },
    });
  });
});

describe("buildCodexArgs", () => {
  it("runs read-only, without the user's config, with Freelens's MCP server and a token from the environment", () => {
    const args = buildCodexArgs(turn);

    expect(args.slice(0, 2)).toEqual(["exec", "--json"]);
    expect(args).toContain("--ignore-user-config");
    expect(args).toContain('sandbox_mode="read-only"');
    expect(args).toContain('mcp_servers.freelens.url="http://127.0.0.1:4000/mcp/chat-1"');
    expect(args).toContain('mcp_servers.freelens.bearer_token_env_var="FREELENS_MCP_TOKEN"');
    expect(args).toContain("browser_use");
  });

  it("puts the system prompt ahead of the first message only", () => {
    const first = buildCodexArgs(turn);
    const next = buildCodexArgs({ ...turn, resumeSessionId: "th-1" });

    expect(first[first.length - 1]).toMatch(/^You are Freelens\.[\s\S]*which pods fail\?$/);
    expect(next.slice(0, 3)).toEqual(["exec", "resume", "th-1"]);
    expect(next[next.length - 1]).toBe("which pods fail?");
  });

  it("passes the model with -m and the effort as model_reasoning_effort", () => {
    const args = buildCodexArgs({ ...turn, model: "gpt-x", effort: "high" });

    expect(valueOf(args, "-m")).toBe("gpt-x");
    expect(args).toContain('model_reasoning_effort="high"');
  });
});
