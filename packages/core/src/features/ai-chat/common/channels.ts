/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getMessageChannel, getRequestChannel } from "@freelensapp/messaging";

import type { AiCliEvent } from "./cli-events";

export interface AiToolResult {
  readonly ok: boolean;
  /** What the model reads: the data, or what went wrong. */
  readonly text: string;
}

export interface StartAiCliTurn {
  /** The chat, unique across the cluster frames, so that tool calls reach the frame it lives in. */
  readonly chatId: string;
  readonly provider: "claude" | "codex";
  /** The command to run; empty finds it on the PATH. */
  readonly command: string;
  readonly prompt: string;
  readonly model: string;
  readonly effort: string;
  readonly systemPrompt: string;
  readonly resumeSessionId?: string;
  readonly allowChanges: boolean;
}

export type StartAiCliTurnResult = { readonly ok: true } | { readonly ok: false; readonly error: string };

export const startAiCliTurnChannel = getRequestChannel<StartAiCliTurn, StartAiCliTurnResult>("ai-chat-start-cli-turn");

export const stopAiCliTurnChannel = getRequestChannel<{ readonly chatId: string }, void>("ai-chat-stop-cli-turn");

/** Keeps the tools the MCP server lists in step with the chat's "Allow changes" checkbox. */
export const setAiChatAllowChangesChannel = getRequestChannel<
  { readonly chatId: string; readonly allowChanges: boolean },
  void
>("ai-chat-set-allow-changes");

/** What a command-line agent reported, for the frame that holds the chat. */
export const aiCliEventChannel = getMessageChannel<{ readonly chatId: string; readonly event: AiCliEvent }>(
  "ai-chat-cli-event",
);

/** A tool call of a command-line agent, for the frame that holds the chat to run. */
export const aiToolCallChannel = getMessageChannel<{
  readonly callId: string;
  readonly chatId: string;
  readonly name: string;
  readonly args: unknown;
}>("ai-chat-tool-call");

export const aiToolResultChannel = getRequestChannel<{ readonly callId: string; readonly result: AiToolResult }, void>(
  "ai-chat-tool-result",
);

export interface AiHttpPost {
  readonly url: string;
  readonly body: unknown;
  readonly timeoutMs: number;
}

export type AiHttpPostResult =
  | { readonly ok: true; readonly status: number; readonly text: string }
  | { readonly ok: false; readonly error: string };

/** A request to an OpenAI-compatible server at a URL, sent from the main process. */
export const aiHttpPostChannel = getRequestChannel<AiHttpPost, AiHttpPostResult>("ai-chat-http-post");

export const aiHttpGetChannel = getRequestChannel<
  { readonly url: string; readonly timeoutMs: number },
  AiHttpPostResult
>("ai-chat-http-get");
