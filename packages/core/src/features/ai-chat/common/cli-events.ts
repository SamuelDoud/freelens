/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/** What a turn of a command-line agent reports, in the order it reports it. */
export type AiCliEvent =
  /** The agent's session id, to resume the conversation on the next turn. */
  | { readonly kind: "session"; readonly sessionId: string; readonly model?: string }
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "tool-call"; readonly id: string; readonly name: string; readonly args: unknown }
  | { readonly kind: "tool-result"; readonly id: string; readonly isError: boolean }
  /** The end of the turn; `error` when it failed. */
  | { readonly kind: "done"; readonly error?: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseJsonLine = (line: string): Record<string, unknown> | undefined => {
  try {
    const value = JSON.parse(line) as unknown;

    return isRecord(value) ? value : undefined;
  } catch {
    return undefined;
  }
};

// The MCP server is named "freelens", so Claude Code calls its tools mcp__freelens__<tool>.
const stripMcpPrefix = (name: string) => name.replace(/^mcp__freelens__/, "");

/** The events of one line of `claude -p --output-format stream-json --verbose`. */
export function parseClaudeStreamLine(line: string): AiCliEvent[] {
  const event = parseJsonLine(line);

  if (!event) {
    return [];
  }

  switch (event.type) {
    case "system":
      return event.subtype === "init" && typeof event.session_id === "string"
        ? [
            {
              kind: "session",
              sessionId: event.session_id,
              model: typeof event.model === "string" ? event.model : undefined,
            },
          ]
        : [];
    case "assistant":
    case "user": {
      const message = isRecord(event.message) ? event.message : undefined;
      const content = Array.isArray(message?.content) ? message.content : [];

      return content.flatMap((block): AiCliEvent[] => {
        if (!isRecord(block)) {
          return [];
        }

        if (event.type === "assistant" && block.type === "text" && typeof block.text === "string" && block.text) {
          return [{ kind: "text", text: block.text }];
        }

        if (event.type === "assistant" && block.type === "tool_use" && typeof block.name === "string") {
          return [
            { kind: "tool-call", id: String(block.id ?? ""), name: stripMcpPrefix(block.name), args: block.input },
          ];
        }

        if (event.type === "user" && block.type === "tool_result") {
          return [{ kind: "tool-result", id: String(block.tool_use_id ?? ""), isError: block.is_error === true }];
        }

        return [];
      });
    }
    case "result":
      return [
        event.is_error === true || (typeof event.subtype === "string" && event.subtype !== "success")
          ? {
              kind: "done",
              error: typeof event.result === "string" && event.result ? event.result : String(event.subtype),
            }
          : { kind: "done" },
      ];
    default:
      return [];
  }
}

/** The events of one line of `codex exec --json`. */
export function parseCodexStreamLine(line: string): AiCliEvent[] {
  const event = parseJsonLine(line);

  if (!event) {
    return [];
  }

  switch (event.type) {
    case "thread.started":
      return typeof event.thread_id === "string" ? [{ kind: "session", sessionId: event.thread_id }] : [];
    case "item.started":
    case "item.completed": {
      const item = isRecord(event.item) ? event.item : undefined;

      if (!item) {
        return [];
      }

      const id = String(item.id ?? "");

      // The final answer is "agent_message" in some versions and "assistant_message" in others.
      if (
        event.type === "item.completed" &&
        (item.type === "agent_message" || item.type === "assistant_message") &&
        typeof item.text === "string"
      ) {
        return item.text ? [{ kind: "text", text: item.text }] : [];
      }

      if (item.type === "mcp_tool_call") {
        const name = stripMcpPrefix(String(item.tool ?? item.name ?? ""));

        return event.type === "item.started"
          ? [{ kind: "tool-call", id, name, args: item.arguments }]
          : [{ kind: "tool-result", id, isError: item.status === "failed" || isRecord(item.error) }];
      }

      if (item.type === "error" && event.type === "item.completed") {
        return [{ kind: "text", text: `Codex: ${String(item.message ?? "error")}` }];
      }

      return [];
    }
    case "turn.completed":
      return [{ kind: "done" }];
    case "turn.failed": {
      const error = isRecord(event.error) ? event.error.message : event.error;

      return [{ kind: "done", error: typeof error === "string" ? error : "The turn failed" }];
    }
    // Not necessarily the end: Codex reports retries this way too. A failed turn ends with turn.failed.
    case "error":
      return [{ kind: "text", text: `Codex: ${typeof event.message === "string" ? event.message : "error"}` }];
    default:
      return [];
  }
}
