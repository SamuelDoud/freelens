/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it, vi } from "vitest";
import { AiChatMirror } from "./chat-mirror.injectable";

import type { AiChatSnapshot } from "../common/chat-state";

const chat = (seq: number, texts: string[]): AiChatSnapshot => ({
  id: "chat",
  clusterId: "c",
  clusterName: "n",
  placement: "bottom",
  provider: "claude",
  model: "m",
  effort: "e",
  allowChanges: false,
  running: false,
  items: texts.map((text, index) => ({ kind: "user", id: String(index), text })),
  seq,
});

describe("AiChatMirror", () => {
  const setup = (held?: AiChatSnapshot) => {
    const get = vi.fn(async () => held);
    const mirror = new AiChatMirror({
      list: async () => [],
      get,
      create: async () => chat(0, []),
      command: async () => {},
    });

    return { mirror, get };
  };

  it("applies the delta that follows the chat", () => {
    const { mirror, get } = setup();

    mirror.receive({ kind: "snapshot", snapshot: chat(0, []) });
    mirror.receive({
      kind: "delta",
      delta: {
        chatId: "chat",
        seq: 1,
        length: 1,
        changes: [{ index: 0, item: { kind: "user", id: "0", text: "hi" } }],
      },
    });

    expect(mirror.get("chat")).toEqual(chat(1, ["hi"]));
    expect(get).not.toHaveBeenCalled();
  });

  it("asks for the chat once when it misses a delta, and when it does not know the chat", async () => {
    const { mirror, get } = setup(chat(5, ["a", "b"]));
    const skipping = { kind: "delta", delta: { chatId: "chat", seq: 3, settings: { running: true } } } as const;

    mirror.receive(skipping);
    mirror.receive(skipping);
    expect(get).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(mirror.get("chat")).toEqual(chat(5, ["a", "b"])));

    mirror.receive({ kind: "snapshot", snapshot: chat(2, ["old"]) });
    expect(mirror.get("chat")?.seq).toBe(5);

    mirror.receive({ kind: "delta", delta: { chatId: "chat", seq: 7, settings: { running: true } } });
    expect(get).toHaveBeenCalledTimes(2);
  });
});
