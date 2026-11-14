/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it, vi } from "vitest";
import { runOpenAiTurn } from "./openai-agent";
import { getAvailableAiTools } from "./tools";

import type { OpenAiMessage } from "./openai-agent";

describe("runOpenAiTurn", () => {
  it("runs the tool calls the model asks for until it answers", async () => {
    const post = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: "<think>let me look</think>",
              tool_calls: [
                { id: "c1", type: "function", function: { name: "list_resources", arguments: '{"kind":"Pod"}' } },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({ choices: [{ message: { content: "Two pods are failing." } }] });
    const execute = vi.fn().mockResolvedValue({ ok: true, text: "2 Pods" });
    const onText = vi.fn();
    const history: OpenAiMessage[] = [];

    await runOpenAiTurn(
      { systemPrompt: "sys", history, prompt: "what fails?", model: "muse", effort: "high" },
      { post, execute, onText, tools: () => getAvailableAiTools(false), isStopped: () => false },
    );

    expect(execute).toHaveBeenCalledWith("list_resources", { kind: "Pod" });
    expect(onText.mock.calls).toEqual([["Two pods are failing."]]);
    expect(history.map((message) => message.role)).toEqual(["user", "assistant", "tool", "assistant"]);

    const firstRequest = post.mock.calls[0][0];

    expect(firstRequest.model).toBe("muse");
    expect(firstRequest.reasoning_effort).toBe("high");
    expect(firstRequest.messages[0]).toEqual({ role: "system", content: "sys" });
    expect(firstRequest.tools.map((tool: { function: { name: string } }) => tool.function.name)).not.toContain(
      "delete_resource",
    );
  });

  it("answers invalid tool arguments with an error instead of running the tool", async () => {
    const post = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [{ id: "c1", type: "function", function: { name: "get_events", arguments: "{oops" } }],
            },
          },
        ],
      })
      .mockResolvedValueOnce({ choices: [{ message: { content: "Sorry." } }] });
    const execute = vi.fn();
    const history: OpenAiMessage[] = [];

    await runOpenAiTurn(
      { systemPrompt: "sys", history, prompt: "events?", model: "", effort: "" },
      { post, execute, onText: () => {}, tools: () => [], isStopped: () => false },
    );

    expect(execute).not.toHaveBeenCalled();
    expect(history[2]).toEqual({
      role: "tool",
      tool_call_id: "c1",
      content: "Error: The arguments were not valid JSON.",
    });
  });

  it("fails when the server gives no message", async () => {
    await expect(
      runOpenAiTurn(
        { systemPrompt: "", history: [], prompt: "hi", model: "", effort: "" },
        {
          post: async () => ({ error: "model not loaded" }),
          execute: vi.fn(),
          onText: () => {},
          tools: () => [],
          isStopped: () => false,
        },
      ),
    ).rejects.toThrow(/model not loaded/);
  });
});
