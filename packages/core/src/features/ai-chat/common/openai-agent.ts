/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { AiToolResult } from "./channels";
import type { AiToolSpec } from "./tools";

export interface OpenAiToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export type OpenAiMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: OpenAiToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export interface OpenAiTurnDependencies {
  /** Posts a chat completion request and returns the parsed response. */
  post: (body: Record<string, unknown>) => Promise<unknown>;
  execute: (name: string, args: unknown) => Promise<AiToolResult>;
  tools: () => readonly AiToolSpec[];
  onText: (text: string) => void;
  isStopped: () => boolean;
}

export interface OpenAiTurn {
  systemPrompt: string;
  history: OpenAiMessage[];
  prompt: string;
  model: string;
  effort: string;
}

// The conversation sent to the server stays under about 50k tokens: past this many characters the
// oldest tool results are shortened, the latest turn always whole.
export const historyBudgetCharacters = 200_000;
const shortenedToolResultCharacters = 400;

const sizeOf = (message: OpenAiMessage) =>
  (typeof message.content === "string" ? message.content.length : 0) +
  ("tool_calls" in message && message.tool_calls ? JSON.stringify(message.tool_calls).length : 0);

/**
 * Shortens the oldest tool results of a history, in place, until it fits the budget. Everything
 * from the latest user message on is left alone, and so are the people's and the model's words.
 */
export function shortenOldToolResults(history: OpenAiMessage[], budget = historyBudgetCharacters) {
  let total = history.reduce((sum, message) => sum + sizeOf(message), 0);
  const latestUser = history.findLastIndex((message) => message.role === "user");

  for (let index = 0; index < latestUser && total > budget; index++) {
    const message = history[index];

    if (message.role !== "tool" || message.content.length <= shortenedToolResultCharacters) {
      continue;
    }

    const dropped = message.content.length - shortenedToolResultCharacters;
    const content = `${message.content.slice(0, shortenedToolResultCharacters)}\n… (shortened: ${dropped} more characters of this older result were dropped; ask again if needed)`;

    total -= message.content.length - content.length;
    history[index] = { ...message, content };
  }
}

// A turn that keeps calling tools without answering is stopped here.
const maxSteps = 25;

// Some local models write their reasoning into the content between think tags.
const stripThinking = (text: string) => text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

const parseArguments = (raw: string): unknown => {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return undefined;
  }
};

/**
 * One turn with an OpenAI-compatible chat completions server: send the conversation and the tools,
 * run the tool calls it asks for, and repeat until it answers without calling a tool.
 * The history is extended in place, so that the next turn continues the conversation.
 */
export async function runOpenAiTurn(turn: OpenAiTurn, dependencies: OpenAiTurnDependencies): Promise<void> {
  turn.history.push({ role: "user", content: turn.prompt });
  shortenOldToolResults(turn.history);

  for (let step = 0; step < maxSteps; step++) {
    if (dependencies.isStopped()) {
      return;
    }

    const response = (await dependencies.post({
      ...(turn.model ? { model: turn.model } : {}),
      messages: [{ role: "system", content: turn.systemPrompt }, ...turn.history],
      tools: dependencies.tools().map(({ name, description, inputSchema }) => ({
        type: "function",
        function: { name, description, parameters: inputSchema },
      })),
      tool_choice: "auto",
      ...(turn.effort ? { reasoning_effort: turn.effort } : {}),
      stream: false,
    })) as { choices?: { message?: { content?: string | null; tool_calls?: OpenAiToolCall[] } }[]; error?: unknown };

    const message = response?.choices?.[0]?.message;

    if (!message) {
      throw new Error(`The server gave no answer: ${JSON.stringify(response?.error ?? response).slice(0, 500)}`);
    }

    const toolCalls = message.tool_calls ?? [];
    const content = typeof message.content === "string" ? message.content : null;

    turn.history.push({ role: "assistant", content, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) });

    const text = content ? stripThinking(content) : "";

    if (text) {
      dependencies.onText(text);
    }

    if (toolCalls.length === 0) {
      return;
    }

    for (const call of toolCalls) {
      const args = parseArguments(call.function.arguments);
      const result =
        args === undefined
          ? { ok: false, text: "The arguments were not valid JSON." }
          : await dependencies.execute(call.function.name, args);

      turn.history.push({
        role: "tool",
        tool_call_id: call.id,
        content: result.ok ? result.text : `Error: ${result.text}`,
      });
    }
  }

  dependencies.onText(`(Stopped after ${maxSteps} tool calls without an answer.)`);
}
