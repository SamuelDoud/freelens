/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { AiChatHost } from "../main/chat-host";
import { applyAiChatDelta, diffAiChat } from "./chat-delta";
import { defaultAiChatPreferences } from "./preferences";

import type { AiChatHostDependencies } from "../main/chat-host";
import type { AiCliTurns } from "../main/cli-turns";
import type { AiMuseSessions } from "../main/muse-acp";
import type { AiChatStateMessage } from "./chat-delta";
import type { AiChatSnapshot } from "./chat-state";

/** A view as the renderer keeps it: it applies what it receives, and asks for the chat when it must. */
class View {
  chats = new Map<string, AiChatSnapshot>();
  resyncs = 0;
  bytes = 0;

  constructor(
    private readonly get: (chatId: string) => AiChatSnapshot | undefined,
    private readonly lossRate = 0,
    private readonly random: () => number = () => 1,
  ) {}

  receive(message: AiChatStateMessage) {
    this.bytes += JSON.stringify(message).length;

    if (this.random() < this.lossRate) {
      return;
    }

    if (message.kind === "snapshot") {
      this.chats.set(message.snapshot.id, message.snapshot);

      return;
    }

    const current = this.chats.get(message.delta.chatId);
    const next = current && applyAiChatDelta(current, message.delta);

    if (next) {
      this.chats.set(message.delta.chatId, next);

      return;
    }

    this.resync(message.delta.chatId);
  }

  resync(chatId: string) {
    const snapshot = this.get(chatId);

    this.resyncs += 1;

    if (snapshot && snapshot.seq >= (this.chats.get(chatId)?.seq ?? -1)) {
      this.chats.set(chatId, snapshot);
    }
  }
}

const makeRandom = (seed: number) => {
  let state = seed;

  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;

    return state / 0x7fffffff;
  };
};

describe("AiChat deltas", () => {
  const setup = (random: () => number) => {
    let preferences = { ...defaultAiChatPreferences, askBeforeEachChange: true };
    const views: View[] = [];
    let host!: AiChatHost;
    const frames = new Set(["c1", "c2"]);
    let total = 0;
    const dependencies: AiChatHostDependencies = {
      preferences: () => preferences,
      updatePreferences: (changes) => {
        preferences = { ...preferences, ...changes };
      },
      resolveCommand: async () => "/bin/cli",
      cliTurns: { start: () => {}, stop: () => {} } as unknown as AiCliTurns,
      muse: { prompt: () => {}, stop: () => {}, close: () => {} } as unknown as AiMuseSessions,
      mcpUrlFor: async () => "http://127.0.0.1:1/mcp",
      mcpToken: () => "t",
      hasClusterFrame: (clusterId) => frames.has(clusterId),
      sendState: (message) => {
        total += 1;
        views.forEach((view) => view.receive(message));
      },
      sendClosed: () => {},
      sendToolCall: ({ callId }) =>
        host.resolveToolResult(callId, { ok: true, text: "x".repeat(Math.floor(random() * 200)) }),
      postOpenAi: async () => undefined,
      openWindow: () => {},
      closeWindow: () => {},
      logInfo: () => {},
    };

    host = new AiChatHost(dependencies);

    return { host, views, total: () => total };
  };

  it("rebuilds every view, new, late and lossy, to the snapshot under random events", async () => {
    for (let run = 0; run < 40; run += 1) {
      const random = makeRandom(1000 + run);
      const { host, views } = setup(random);
      const getFromHost = (chatId: string) => host.get(chatId);
      const early = new View(getFromHost);
      const lossy = new View(getFromHost, 0.3, random);

      views.push(early, lossy);

      const chatIds: string[] = [];
      const check = () => {
        for (const view of [...views]) {
          for (const chatId of chatIds) {
            const expected = host.get(chatId);

            // A lossy view may be behind until its next message; it must never be wrong about what it has.
            if (view === lossy && view.chats.get(chatId)?.seq !== expected?.seq) {
              view.resync(chatId);
            }

            if (expected) {
              expect(view.chats.get(chatId)).toEqual(expected);
            }
          }
        }
      };

      for (let step = 0; step < 120; step += 1) {
        const roll = random();
        const chatId = chatIds.length > 0 ? chatIds[Math.floor(random() * chatIds.length)] : undefined;

        if (!chatId || roll < 0.05) {
          chatIds.push(host.create({ clusterId: random() < 0.5 ? "c1" : "c2", clusterName: "n" }).id);
        } else if (roll < 0.35) {
          host.applyCliEvent(chatId, { kind: "text", text: `answer ${step}` });
        } else if (roll < 0.5) {
          await host.callTool(chatId, "list_resources", { kind: "Pod" });
        } else if (roll < 0.58) {
          host.applyCliEvent(chatId, { kind: "session", sessionId: `s${step}` });
        } else if (roll < 0.66) {
          await host.command({ type: "settings", chatId, settings: { model: `m${step}`, effort: `e${step % 3}` } });
        } else if (roll < 0.72) {
          await host.command({ type: "allow-changes", chatId, allowChanges: random() < 0.5 });
        } else if (roll < 0.78) {
          await host.command({ type: "move", chatId, placement: random() < 0.5 ? "right" : "bottom" });
        } else if (roll < 0.82) {
          await host.command({ type: "clear", chatId });
        } else if (roll < 0.88) {
          host.applyCliEvent(chatId, { kind: "done", error: random() < 0.5 ? "boom" : undefined });
        } else if (roll < 0.94) {
          // A change tool that asks for approval, which is answered right after, or not.
          await host.command({ type: "allow-changes", chatId, allowChanges: true });

          const call = host.callTool(chatId, "delete_resource", { kind: "Pod", name: "p", namespace: "a" });
          const item = host.get(chatId)?.items.findLast((entry) => entry.kind === "approval");

          if (item) {
            await host.command({ type: "approval", chatId, itemId: item.id, approved: random() < 0.5 });
          }

          await call;
        } else if (views.length < 3) {
          // A view that starts late takes the chats as they are.
          const late = new View(getFromHost);

          for (const id of chatIds) {
            late.resync(id);
          }

          views.push(late);
        }

        check();
      }

      expect(early.resyncs).toBe(0);
      expect(lossy.resyncs).toBeGreaterThan(0);
    }
  });

  it("sends a message that stays small as the chat grows", async () => {
    const { host, views } = setup(makeRandom(7));
    const view = new View((chatId) => host.get(chatId));
    const sizes: number[] = [];

    views.push({ receive: (message: AiChatStateMessage) => sizes.push(JSON.stringify(message).length) } as never, view);

    const { id } = host.create({ clusterId: "c1", clusterName: "n" });

    for (let index = 0; index < 400; index += 1) {
      host.applyCliEvent(id, { kind: "text", text: "a line of answer ".repeat(20) });
    }

    // The size of a message is the size of the new item, however long the chat is.
    expect(Math.max(...sizes.slice(1))).toBeLessThan(700);
    expect(sizes.at(-1)).toBeLessThanOrEqual(sizes[5] + 10);
    expect(view.chats.get(id)).toEqual(host.get(id));
  });

  it("does not apply a change that skips one, and leaves a chat that is past it as it is", () => {
    const base: AiChatSnapshot = {
      id: "chat",
      clusterId: "c",
      clusterName: "n",
      placement: "bottom",
      provider: "claude",
      model: "m",
      effort: "e",
      allowChanges: false,
      running: false,
      items: [],
      seq: 4,
    };
    const next = { ...base, items: [{ kind: "user", id: "1", text: "hi" } as const] };
    const delta = diffAiChat(base, next, 5)!;

    expect(applyAiChatDelta(base, { ...delta, seq: 6 })).toBeUndefined();
    expect(applyAiChatDelta(base, delta)).toEqual({ ...next, seq: 5 });
    expect(applyAiChatDelta({ ...next, seq: 5 }, delta)).toEqual({ ...next, seq: 5 });
    expect(diffAiChat(base, base, 5)).toBeUndefined();
  });
});
