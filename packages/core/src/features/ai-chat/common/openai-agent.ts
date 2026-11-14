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
