/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/** The environment variable that carries the MCP server's bearer token to Codex. */
export const codexMcpTokenVariable = "FREELENS_MCP_TOKEN";

export interface CliTurnArgs {
  readonly prompt: string;
  readonly model: string;
  readonly effort: string;
  readonly systemPrompt: string;
  /** The agent's session to continue; a new conversation when undefined. */
  readonly resumeSessionId?: string;
  /** For Claude Code: the id of a new session. */
  readonly newSessionId?: string;
  readonly mcpUrl: string;
  /** For Claude Code: the path of the MCP configuration file. */
  readonly mcpConfigPath?: string;
}

/**
 * `claude -p` with Freelens's MCP server as its only tools: `--tools ""` removes every built-in
 * tool (shell, files, web), `--strict-mcp-config` ignores the user's own MCP servers, and
 * `--setting-sources ""` leaves out the user's and projects' settings, hooks included.
 */
export function buildClaudeArgs(args: CliTurnArgs): string[] {
  return [
    "-p",
    args.prompt,
    "--output-format",
    "stream-json",
    "--verbose",
    "--tools",
    "",
    "--strict-mcp-config",
    "--mcp-config",
    args.mcpConfigPath ?? "",
    "--allowed-tools",
    "mcp__freelens",
    "--setting-sources",
    "",
    "--system-prompt",
    args.systemPrompt,
    ...(args.model ? ["--model", args.model] : []),
    ...(args.effort ? ["--effort", args.effort] : []),
    ...(args.resumeSessionId
      ? ["--resume", args.resumeSessionId]
      : args.newSessionId
        ? ["--session-id", args.newSessionId]
        : []),
  ];
}

/** The MCP configuration file for Claude Code. */
export const buildClaudeMcpConfig = (mcpUrl: string, token: string) => ({
  mcpServers: {
    freelens: { type: "http", url: mcpUrl, headers: { Authorization: `Bearer ${token}` } },
  },
});

const tomlString = (value: string) => JSON.stringify(value);

// Codex's own ways out to the world besides its shell.
const codexDisabledFeatures = ["browser_use", "browser_use_external", "apps"];

/**
 * `codex exec --json` with Freelens's MCP server. Its shell runs in the read-only sandbox, which
 * also has no network, so the only way to the cluster is through Freelens's tools. Codex has no
 * flag for a system prompt, so it goes ahead of the first message of a conversation.
 */
export function buildCodexArgs(args: CliTurnArgs): string[] {
  const prompt = args.resumeSessionId
    ? args.prompt
    : `${args.systemPrompt}\n\n---\n\nThe user's message:\n\n${args.prompt}`;

  return [
    "exec",
    ...(args.resumeSessionId ? ["resume", args.resumeSessionId] : []),
    "--json",
    "--skip-git-repo-check",
    // The user's config.toml would add their own MCP servers and could loosen the sandbox.
    "--ignore-user-config",
    ...codexDisabledFeatures.flatMap((feature) => ["--disable", feature]),
    // `exec resume` has no --sandbox flag; the setting applies to both.
    "-c",
    'sandbox_mode="read-only"',
    "-c",
    `mcp_servers.freelens.url=${tomlString(args.mcpUrl)}`,
    "-c",
    `mcp_servers.freelens.bearer_token_env_var=${tomlString(codexMcpTokenVariable)}`,
    "-c",
    'approval_policy="never"',
    ...(args.model ? ["-m", args.model] : []),
    ...(args.effort ? ["-c", `model_reasoning_effort=${tomlString(args.effort)}`] : []),
    prompt,
  ];
}
