/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * The backends the chat talks to:
 * - `claude` (Anthropic's Claude Code), `codex` (OpenAI's Codex) and `muse` (Meta's Muse) are the
 *   vendors' command-line agents, run as installed and signed in on the computer, with Freelens's
 *   tools given to them over MCP and their own tools switched off;
 * - `openai` is any server with the OpenAI chat completions API (llama.cpp, vLLM, Ollama, ...) that
 *   the user configures, and Freelens runs the tool loop.
 */
export type AiProviderId = "claude" | "codex" | "muse" | "openai";

export type AiCliProviderId = Exclude<AiProviderId, "openai">;

export const aiProviderIds: readonly AiProviderId[] = ["claude", "codex", "muse", "openai"];

export const aiCliProviderIds: readonly AiCliProviderId[] = ["claude", "codex", "muse"];

export const isAiProviderId = (value: unknown): value is AiProviderId =>
  typeof value === "string" && (aiProviderIds as readonly string[]).includes(value);

export const isAiCliProviderId = (value: unknown): value is AiCliProviderId =>
  typeof value === "string" && (aiCliProviderIds as readonly string[]).includes(value);

export const aiProviderLabels: Record<AiProviderId, string> = {
  claude: "Claude Code",
  codex: "Codex",
  muse: "Muse",
  openai: "OpenAI-compatible server",
};

/** The command each CLI is installed as. */
export const aiCliCommands: Record<AiCliProviderId, string> = {
  claude: "claude",
  codex: "codex",
  muse: "muse",
};

/** The efforts an OpenAI-compatible server takes as `reasoning_effort`; it cannot be asked for them. */
export const openAiEfforts: readonly string[] = ["low", "medium", "high"];
