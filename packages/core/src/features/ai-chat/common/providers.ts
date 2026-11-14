/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * The backends the chat talks to:
 * - `claude` and `codex` run the user's own command-line agent, signed in as in a terminal, with
 *   Freelens's tools given to it over MCP and its own tools switched off;
 * - `openai` calls a server with the OpenAI chat completions API (llama.cpp, vLLM, Ollama, ...),
 *   reached through the cluster's service proxy or at a URL, and Freelens runs the tool loop.
 */
export type AiProviderId = "claude" | "codex" | "openai";

export const aiProviderIds: readonly AiProviderId[] = ["claude", "codex", "openai"];

export const isAiProviderId = (value: unknown): value is AiProviderId =>
  typeof value === "string" && (aiProviderIds as readonly string[]).includes(value);

/** The efforts each backend accepts; the first entry is the one used when none is chosen. */
export const aiProviderEfforts: Record<AiProviderId, readonly string[]> = {
  claude: ["low", "medium", "high", "xhigh", "max"],
  codex: ["minimal", "low", "medium", "high", "xhigh"],
  openai: ["low", "medium", "high"],
};

/** The models offered until the user lists their own in the preferences. */
export const defaultAiProviderModels: Record<AiProviderId, readonly string[]> = {
  claude: ["opus", "sonnet", "haiku"],
  codex: [],
  openai: [],
};

export const defaultAiProviderLabels: Record<AiProviderId, string> = {
  claude: "Claude Code",
  codex: "Codex",
  openai: "Muse",
};
