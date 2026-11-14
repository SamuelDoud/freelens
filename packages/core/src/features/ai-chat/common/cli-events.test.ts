/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { parseClaudeStreamLine, parseCodexStreamLine } from "./cli-events";

const line = (value: unknown) => JSON.stringify(value);

describe("parseClaudeStreamLine", () => {
  it("reads the session of the init event", () => {
    expect(
      parseClaudeStreamLine(line({ type: "system", subtype: "init", session_id: "s-1", model: "claude-x" })),
    ).toEqual([{ kind: "session", sessionId: "s-1", model: "claude-x" }]);
  });

  it("reads the text and the Freelens tool calls of an assistant message", () => {
    const events = parseClaudeStreamLine(
      line({
        type: "assistant",
        message: {
          content: [
            { type: "text", text: "Looking." },
            { type: "tool_use", id: "t-1", name: "mcp__freelens__list_resources", input: { kind: "Pod" } },
          ],
        },
      }),
    );

    expect(events).toEqual([
      { kind: "text", text: "Looking." },
      { kind: "tool-call", id: "t-1", name: "list_resources", args: { kind: "Pod" } },
    ]);
  });

  it("reads tool results", () => {
    expect(
      parseClaudeStreamLine(
        line({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "t-1", is_error: true }] } }),
      ),
    ).toEqual([{ kind: "tool-result", id: "t-1", isError: true }]);
  });

  it("ends the turn with the result, failed or not", () => {
    expect(
      parseClaudeStreamLine(line({ type: "result", subtype: "success", is_error: false, result: "pong" })),
    ).toEqual([{ kind: "done" }]);
    expect(
      parseClaudeStreamLine(line({ type: "result", subtype: "success", is_error: true, result: "Not logged in" })),
    ).toEqual([{ kind: "done", error: "Not logged in" }]);
    expect(parseClaudeStreamLine(line({ type: "result", subtype: "error_max_turns" }))).toEqual([
      { kind: "done", error: "error_max_turns" },
    ]);
  });

  it("ignores what it does not know and lines that are not JSON", () => {
    expect(parseClaudeStreamLine(line({ type: "rate_limit_event" }))).toEqual([]);
    expect(parseClaudeStreamLine("not json")).toEqual([]);
  });
});

describe("parseCodexStreamLine", () => {
  it("reads the thread id as the session", () => {
    expect(parseCodexStreamLine(line({ type: "thread.started", thread_id: "th-1" }))).toEqual([
      { kind: "session", sessionId: "th-1" },
    ]);
  });

  it("reads the answer under either name Codex has used for it", () => {
    for (const type of ["agent_message", "assistant_message"]) {
      expect(parseCodexStreamLine(line({ type: "item.completed", item: { id: "i", type, text: "Done." } }))).toEqual([
        { kind: "text", text: "Done." },
      ]);
    }
  });

  it("reads MCP tool calls and their outcome", () => {
    expect(
      parseCodexStreamLine(
        line({
          type: "item.started",
          item: { id: "i-2", type: "mcp_tool_call", server: "freelens", tool: "get_events", arguments: {} },
        }),
      ),
    ).toEqual([{ kind: "tool-call", id: "i-2", name: "get_events", args: {} }]);
    expect(
      parseCodexStreamLine(
        line({
          type: "item.completed",
          item: { id: "i-2", type: "mcp_tool_call", tool: "get_events", status: "failed" },
        }),
      ),
    ).toEqual([{ kind: "tool-result", id: "i-2", isError: true }]);
  });

  it("ends the turn when it completes or fails, and keeps going after a retry error", () => {
    expect(parseCodexStreamLine(line({ type: "turn.completed", usage: {} }))).toEqual([{ kind: "done" }]);
    expect(parseCodexStreamLine(line({ type: "turn.failed", error: { message: "quota" } }))).toEqual([
      { kind: "done", error: "quota" },
    ]);
    expect(parseCodexStreamLine(line({ type: "error", message: "Reconnecting 1/5" }))).toEqual([
      { kind: "text", text: "Codex: Reconnecting 1/5" },
    ]);
  });
});
