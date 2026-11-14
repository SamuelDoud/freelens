/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultAiChatPreferences } from "../common/preferences";
import { AiChatHost } from "./chat-host";

import type { AiChatSnapshot } from "../common/chat-state";
import type { AiChatPreferences } from "../common/preferences";
import type { AiChatHostDependencies } from "./chat-host";
import type { AiCliTurns } from "./cli-turns";
import type { AiMuseSessions } from "./muse-acp";

describe("AiChatHost", () => {
  let preferences: AiChatPreferences;
  let dependencies: AiChatHostDependencies;
  let host: AiChatHost;
  let snapshots: AiChatSnapshot[];
  let frames: Set<string>;
  let cliTurns: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> };

  const last = () => snapshots[snapshots.length - 1];

  beforeEach(() => {
    preferences = { ...defaultAiChatPreferences };
    snapshots = [];
    frames = new Set(["cluster-1"]);
    cliTurns = { start: vi.fn(), stop: vi.fn() };
    dependencies = {
      preferences: () => preferences,
      updatePreferences: (changes) => {
        preferences = { ...preferences, ...changes };
      },
      resolveCommand: (provider) => `/usr/local/bin/${provider}`,
      cliTurns: cliTurns as unknown as AiCliTurns,
      muse: { prompt: vi.fn(), stop: vi.fn(), close: vi.fn() } as unknown as AiMuseSessions,
      mcpUrlFor: async (chatId) => `http://127.0.0.1:1/mcp/${chatId}`,
      mcpToken: () => "token",
      hasClusterFrame: (clusterId) => frames.has(clusterId),
      sendSnapshot: (snapshot) => snapshots.push(snapshot),
      sendClosed: vi.fn(),
      sendToolCall: vi.fn(),
      postOpenAi: vi.fn(),
      openWindow: vi.fn(),
      closeWindow: vi.fn(),
      logInfo: () => {},
    };
    host = new AiChatHost(dependencies);
  });

  it("creates a chat with the preferred backend and placement, and changes off", () => {
    preferences = { ...preferences, defaultProvider: "codex", placement: "right" };

    const chat = host.create({ clusterId: "cluster-1", clusterName: "homelab" });

    expect(chat).toMatchObject({
      provider: "codex",
      placement: "right",
      allowChanges: false,
      running: false,
      items: [],
    });
    expect(host.list("cluster-1").map(({ id }) => id)).toEqual([chat.id]);
    expect(host.list("other")).toEqual([]);
  });

  it("refuses a change tool while the chat does not allow changes, without reaching the cluster", async () => {
    const { id } = host.create({ clusterId: "cluster-1", clusterName: "homelab" });

    const result = await host.callTool(id, "delete_resource", { kind: "Pod", name: "p", namespace: "a" });

    expect(result.ok).toBe(false);
    expect(result.text).toMatch(/Allow changes/);
    expect(dependencies.sendToolCall).not.toHaveBeenCalled();
  });

  it("runs a tool in the chat's cluster frame and shows it in the chat", async () => {
    const { id } = host.create({ clusterId: "cluster-1", clusterName: "homelab" });
    vi.mocked(dependencies.sendToolCall).mockImplementation(({ callId }) =>
      host.resolveToolResult(callId, { ok: true, text: "3 Pods" }),
    );

    const result = await host.callTool(id, "list_resources", { kind: "Pod" });

    expect(result).toEqual({ ok: true, text: "3 Pods" });
    expect(dependencies.sendToolCall).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: id, clusterId: "cluster-1", name: "list_resources", allowChanges: false }),
    );
    expect(last().items).toEqual([
      expect.objectContaining({ kind: "tool", name: "list_resources", status: "done", output: "3 Pods" }),
    ]);
  });

  it("says when the chat's cluster is not open, instead of waiting", async () => {
    const { id } = host.create({ clusterId: "cluster-2", clusterName: "staging" });

    const result = await host.callTool(id, "list_resources", { kind: "Pod" });

    expect(result.ok).toBe(false);
    expect(result.text).toMatch(/"staging" is not open in Freelens/);
    expect(dependencies.sendToolCall).not.toHaveBeenCalled();
  });

  it("asks for approval of each change when the preferences say so", async () => {
    preferences = { ...preferences, askBeforeEachChange: true };

    const { id } = host.create({ clusterId: "cluster-1", clusterName: "homelab" });

    await host.command({ type: "allow-changes", chatId: id, allowChanges: true });

    const rejected = host.callTool(id, "delete_resource", { kind: "Pod", name: "p", namespace: "a" });
    const approval = last().items.find((item) => item.kind === "approval");

    await host.command({ type: "approval", chatId: id, itemId: approval!.id, approved: false });

    expect((await rejected).ok).toBe(false);
    expect(dependencies.sendToolCall).not.toHaveBeenCalled();

    vi.mocked(dependencies.sendToolCall).mockImplementation(({ callId }) =>
      host.resolveToolResult(callId, { ok: true, text: "Done" }),
    );

    const approved = host.callTool(id, "delete_resource", { kind: "Pod", name: "p", namespace: "a" });
    const secondApproval = last().items.filter((item) => item.kind === "approval")[1];

    await host.command({ type: "approval", chatId: id, itemId: secondApproval.id, approved: true });

    expect(await approved).toEqual({ ok: true, text: "Done" });
  });

  it("moves a chat between placements, one window at a time, and remembers the choice", async () => {
    const first = host.create({ clusterId: "cluster-1", clusterName: "homelab" });
    const second = host.create({ clusterId: "cluster-1", clusterName: "homelab" });

    await host.command({ type: "move", chatId: first.id, placement: "window" });

    expect(dependencies.openWindow).toHaveBeenCalledWith(first.id, "AI chat — homelab");
    expect(preferences.placement).toBe("window");

    await host.command({ type: "move", chatId: second.id, placement: "window" });

    expect(host.get(first.id)?.placement).toBe("bottom");
    expect(host.get(second.id)?.placement).toBe("window");

    await host.command({ type: "move", chatId: second.id, placement: "right" });

    expect(dependencies.closeWindow).toHaveBeenCalledWith(second.id);
    expect(host.get(second.id)?.placement).toBe("right");
  });

  it("brings a chat back to the dock when the user closes its window", async () => {
    const { id } = host.create({ clusterId: "cluster-1", clusterName: "homelab", placement: "window" });

    preferences = { ...preferences, placement: "window" };
    host.windowClosed(id);

    expect(host.get(id)?.placement).toBe("bottom");
    expect(preferences.placement).toBe("bottom");
  });

  it("sends a turn to the CLI, continuing its session, and records what it reports", async () => {
    const { id } = host.create({ clusterId: "cluster-1", clusterName: "homelab" });

    await host.command({ type: "send", chatId: id, text: "which pods fail?" });

    expect(last().running).toBe(true);
    expect(cliTurns.start).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "claude",
        command: "/usr/local/bin/claude",
        prompt: "which pods fail?",
        resumeSessionId: undefined,
      }),
      expect.any(Function),
    );

    host.applyCliEvent(id, { kind: "session", sessionId: "s-1" });
    host.applyCliEvent(id, { kind: "text", text: "None." });
    host.applyCliEvent(id, { kind: "done" });

    expect(last()).toMatchObject({ running: false });
    expect(last().items.map((item) => item.kind)).toEqual(["user", "assistant"]);

    await host.command({ type: "send", chatId: id, text: "and now?" });

    expect(cliTurns.start).toHaveBeenLastCalledWith(
      expect.objectContaining({ resumeSessionId: "s-1" }),
      expect.any(Function),
    );
  });

  it("explains a CLI that is not installed", async () => {
    dependencies.resolveCommand = () => undefined;
    host = new AiChatHost(dependencies);

    const { id } = host.create({ clusterId: "cluster-1", clusterName: "homelab" });

    await host.command({ type: "send", chatId: id, text: "hi" });

    expect(last().running).toBe(false);
    expect(last().items[1]).toMatchObject({ kind: "notice", tone: "error" });
    expect(cliTurns.start).not.toHaveBeenCalled();
  });

  it("closes a chat and tells the views", async () => {
    const { id } = host.create({ clusterId: "cluster-1", clusterName: "homelab" });

    await host.command({ type: "close", chatId: id });

    expect(host.get(id)).toBeUndefined();
    expect(dependencies.sendClosed).toHaveBeenCalledWith(id);
  });
});
