/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { randomUUID } from "node:crypto";
import { defaultAiSystemPrompt } from "../common/default-system-prompt";
import { runOpenAiTurn } from "../common/openai-agent";
import { findAiTool, getAvailableAiTools } from "../common/tools";

import type { AiChatCommand, AiToolResult, CreateAiChat } from "../common/channels";
import type { AiChatItem, AiChatSettings, AiChatSnapshot, NewAiChatItem } from "../common/chat-state";
import type { AiCliEvent } from "../common/cli-events";
import type { OpenAiMessage } from "../common/openai-agent";
import type { AiChatPlacement, AiChatPreferences } from "../common/preferences";
import type { AiCliProviderId, AiProviderId } from "../common/providers";
import type { AiCliTurns } from "./cli-turns";
import type { AiMuseSessions } from "./muse-acp";

export interface AiChatHostDependencies {
  preferences: () => AiChatPreferences;
  updatePreferences: (changes: Partial<AiChatPreferences>) => void;
  /** The command a CLI runs as, or undefined when it is not installed. */
  resolveCommand: (provider: AiCliProviderId) => string | undefined;
  cliTurns: AiCliTurns;
  muse: AiMuseSessions;
  mcpUrlFor: (chatId: string) => Promise<string>;
  mcpToken: () => string;
  /** Whether the cluster's frame is open in the main window, where the tools run. */
  hasClusterFrame: (clusterId: string) => boolean;
  sendSnapshot: (snapshot: AiChatSnapshot) => void;
  sendClosed: (chatId: string) => void;
  sendToolCall: (call: {
    callId: string;
    chatId: string;
    clusterId: string;
    name: string;
    args: unknown;
    allowChanges: boolean;
  }) => void;
  /** Posts to the configured OpenAI-compatible server's chat completions, for a chat's cluster. */
  postOpenAi: (clusterId: string, body: Record<string, unknown>, signal: AbortSignal) => Promise<unknown>;
  openWindow: (chatId: string, title: string) => void;
  closeWindow: (chatId: string) => void;
  logInfo: (message: string) => void;
}

interface ChatRecord {
  id: string;
  clusterId: string;
  clusterName: string;
  placement: AiChatPlacement;
  provider: AiProviderId;
  model: string;
  effort: string;
  allowChanges: boolean;
  running: boolean;
  items: AiChatItem[];
  sessions: Map<AiProviderId, string>;
  openAiHistory: OpenAiMessage[];
  abortController?: AbortController;
  approvals: Map<string, (approved: boolean) => void>;
}

// A tool runs in the cluster frame in a few seconds; this only catches a frame that never answers.
const toolCallTimeoutMs = 60_000;

let nextItemId = 0;
const newItemId = () => `item-${Date.now()}-${nextItemId++}`;

/**
 * The AI chats of the application. They live in the main process so that a chat can show in a
 * cluster frame's dock or right panel or in a window of its own, and move between them while it
 * runs. The tools still run in the cluster frame of the chat's cluster, which they read and drive.
 */
export class AiChatHost {
  private readonly chats = new Map<string, ChatRecord>();
  private readonly pendingToolCalls = new Map<
    string,
    { resolve: (result: AiToolResult) => void; timer: ReturnType<typeof setTimeout> }
  >();
  private nextCallId = 0;

  constructor(private readonly dependencies: AiChatHostDependencies) {}

  create({ clusterId, clusterName, placement }: CreateAiChat): AiChatSnapshot {
    const preferences = this.dependencies.preferences();
    const provider = preferences.defaultProvider;
    const chat: ChatRecord = {
      id: randomUUID(),
      clusterId,
      clusterName,
      placement: placement ?? preferences.placement,
      provider,
      model: preferences.providers[provider].defaultModel,
      effort: preferences.providers[provider].defaultEffort,
      allowChanges: false,
      running: false,
      items: [],
      sessions: new Map(),
      openAiHistory: [],
      approvals: new Map(),
    };

    this.chats.set(chat.id, chat);

    if (chat.placement === "window") {
      this.dependencies.openWindow(chat.id, this.windowTitle(chat));
    }

    this.publish(chat);

    return this.snapshot(chat);
  }

  list(clusterId?: string): AiChatSnapshot[] {
    return [...this.chats.values()]
      .filter((chat) => clusterId === undefined || chat.clusterId === clusterId)
      .map((chat) => this.snapshot(chat));
  }

  get(chatId: string): AiChatSnapshot | undefined {
    const chat = this.chats.get(chatId);

    return chat && this.snapshot(chat);
  }

  allowsChanges(chatId: string): boolean {
    return this.chats.get(chatId)?.allowChanges ?? false;
  }

  async command(command: AiChatCommand): Promise<void> {
    const chat = this.chats.get(command.chatId);

    if (!chat) {
      return;
    }

    switch (command.type) {
      case "send":
        return this.send(chat, command.text);
      case "stop":
        return this.stop(chat);
      case "settings":
        Object.assign(chat, command.settings satisfies Partial<AiChatSettings>);
        break;
      case "allow-changes":
        chat.allowChanges = command.allowChanges;
        break;
      case "approval":
        this.resolveApproval(chat, command.itemId, command.approved);
        break;
      case "move":
        return this.move(chat, command.placement);
      case "clear":
        this.rejectApprovals(chat);
        chat.items = [];
        chat.sessions.clear();
        chat.openAiHistory = [];
        this.dependencies.muse.close(chat.id);
        break;
      case "close":
        return this.close(chat);
    }

    this.publish(chat);
  }

  /** The user closed a chat's window: the chat goes back to the dock of its cluster. */
  windowClosed(chatId: string) {
    const chat = this.chats.get(chatId);

    if (chat?.placement === "window") {
      chat.placement = "bottom";
      // Closing the window says the user does not want one: new chats open in the dock again.
      this.dependencies.updatePreferences({ placement: "bottom" });
      this.publish(chat);
    }
  }

  /** What a command-line agent reported for a chat. */
  applyCliEvent(chatId: string, event: AiCliEvent) {
    const chat = this.chats.get(chatId);

    if (!chat) {
      return;
    }

    switch (event.kind) {
      case "session":
        chat.sessions.set(chat.provider, event.sessionId);
        break;
      case "text":
        this.add(chat, { kind: "assistant", text: event.text });
        break;
      case "done":
        this.rejectApprovals(chat);
        chat.running = false;

        if (event.error) {
          this.add(chat, { kind: "notice", tone: "error", text: event.error });
        }
        break;
      // Tool calls show as they are run, by callTool.
      default:
        break;
    }

    this.publish(chat);
  }

  /**
   * A tool call of a chat's backend: checked against "Allow changes", approved by the user when the
   * preferences ask for it, and run in the cluster frame of the chat's cluster.
   */
  async callTool(chatId: string, name: string, args: unknown): Promise<AiToolResult> {
    const chat = this.chats.get(chatId);
    const tool = findAiTool(name);

    if (!chat) {
      return { ok: false, text: "This chat was closed." };
    }

    if (!tool) {
      return { ok: false, text: `There is no tool ${name}.` };
    }

    if (tool.access === "change" && !chat.allowChanges) {
      return { ok: false, text: 'Changes are not allowed in this chat: the user has to tick "Allow changes".' };
    }

    const itemId = this.add(chat, { kind: "tool", name, args, status: "running" });

    this.publish(chat);

    const result = await this.runTool(chat, tool.access === "change", name, args);

    this.update(chat, itemId, { status: result.ok ? "done" : "failed", output: result.text });
    this.publish(chat);

    return result;
  }

  resolveToolResult(callId: string, result: AiToolResult) {
    const pending = this.pendingToolCalls.get(callId);

    if (pending) {
      clearTimeout(pending.timer);
      this.pendingToolCalls.delete(callId);
      pending.resolve(result);
    }
  }

  private async runTool(chat: ChatRecord, isChange: boolean, name: string, args: unknown): Promise<AiToolResult> {
    if (!this.dependencies.hasClusterFrame(chat.clusterId)) {
      return {
        ok: false,
        text: `The cluster "${chat.clusterName}" is not open in Freelens. Ask the user to open it to let you use it.`,
      };
    }

    if (isChange && this.dependencies.preferences().askBeforeEachChange) {
      const approved = await this.requestApproval(chat, `${name} ${JSON.stringify(args)}`);

      if (!approved) {
        return { ok: false, text: `The user rejected the change: ${name} ${JSON.stringify(args)}` };
      }
    }

    const callId = `${Date.now()}-${this.nextCallId++}`;

    return new Promise<AiToolResult>((resolve) => {
      const timer = setTimeout(() => {
        this.pendingToolCalls.delete(callId);
        resolve({ ok: false, text: `The cluster "${chat.clusterName}" did not answer the tool call in time.` });
      }, toolCallTimeoutMs);

      this.pendingToolCalls.set(callId, { resolve, timer });
      this.dependencies.sendToolCall({
        callId,
        chatId: chat.id,
        clusterId: chat.clusterId,
        name,
        args,
        allowChanges: chat.allowChanges,
      });
    });
  }

  private systemPrompt(chat: ChatRecord) {
    const custom = this.dependencies.preferences().systemPrompt.trim();

    return `${custom || defaultAiSystemPrompt}\n\nThe cluster open in Freelens is "${chat.clusterName}".`;
  }

  private async send(chat: ChatRecord, prompt: string) {
    const text = prompt.trim();

    if (!text || chat.running) {
      return;
    }

    this.add(chat, { kind: "user", text });
    chat.running = true;
    this.publish(chat);

    if (chat.provider === "openai") {
      return this.sendToOpenAi(chat, text);
    }

    const command = this.dependencies.resolveCommand(chat.provider);

    if (!command) {
      this.applyCliEvent(chat.id, {
        kind: "done",
        error: `Freelens could not find the ${chat.provider} command. Install it, or set its path in Preferences → AI.`,
      });

      return;
    }

    const mcpUrl = await this.dependencies.mcpUrlFor(chat.id);
    const turn = {
      chatId: chat.id,
      command,
      prompt: text,
      model: chat.model,
      effort: chat.effort,
      systemPrompt: this.systemPrompt(chat),
      mcpUrl,
      mcpToken: this.dependencies.mcpToken(),
    };
    const onEvent = (event: AiCliEvent) => this.applyCliEvent(chat.id, event);

    if (chat.provider === "muse") {
      await this.dependencies.muse.prompt(turn, onEvent);
    } else {
      this.dependencies.cliTurns.start(
        { ...turn, provider: chat.provider, resumeSessionId: chat.sessions.get(chat.provider) },
        onEvent,
      );
    }
  }

  private async sendToOpenAi(chat: ChatRecord, text: string) {
    const abortController = new AbortController();

    chat.abortController = abortController;

    try {
      await runOpenAiTurn(
        {
          systemPrompt: this.systemPrompt(chat),
          history: chat.openAiHistory,
          prompt: text,
          model: chat.model,
          effort: chat.effort,
        },
        {
          post: (body) => this.dependencies.postOpenAi(chat.clusterId, body, abortController.signal),
          execute: (name, args) => this.callTool(chat.id, name, args),
          tools: () => getAvailableAiTools(chat.allowChanges),
          onText: (answer) => {
            this.add(chat, { kind: "assistant", text: answer });
            this.publish(chat);
          },
          isStopped: () => abortController.signal.aborted,
        },
      );
      this.applyCliEvent(chat.id, { kind: "done" });
    } catch (error) {
      this.applyCliEvent(chat.id, {
        kind: "done",
        error: abortController.signal.aborted ? "Stopped." : error instanceof Error ? error.message : String(error),
      });
    } finally {
      chat.abortController = undefined;
    }
  }

  private stop(chat: ChatRecord) {
    this.rejectApprovals(chat);

    if (chat.provider === "openai") {
      chat.abortController?.abort();
    } else if (chat.provider === "muse") {
      this.dependencies.muse.stop(chat.id);
    } else {
      this.dependencies.cliTurns.stop(chat.id);
    }
  }

  private move(chat: ChatRecord, placement: AiChatPlacement) {
    const previous = chat.placement;

    if (previous === placement) {
      return;
    }

    // One chat window at a time: a chat that had it goes back to the dock.
    if (placement === "window") {
      for (const other of this.chats.values()) {
        if (other !== chat && other.placement === "window") {
          other.placement = "bottom";
          this.publish(other);
        }
      }
    }

    chat.placement = placement;
    this.dependencies.updatePreferences({ placement });

    if (placement === "window") {
      this.dependencies.openWindow(chat.id, this.windowTitle(chat));
    } else if (previous === "window") {
      this.dependencies.closeWindow(chat.id);
    }

    this.publish(chat);
  }

  private close(chat: ChatRecord) {
    this.stop(chat);
    this.dependencies.muse.close(chat.id);

    if (chat.placement === "window") {
      this.dependencies.closeWindow(chat.id);
    }

    this.chats.delete(chat.id);
    this.dependencies.sendClosed(chat.id);
  }

  private windowTitle(chat: ChatRecord) {
    return `AI chat — ${chat.clusterName}`;
  }

  private requestApproval(chat: ChatRecord, description: string): Promise<boolean> {
    const itemId = this.add(chat, { kind: "approval", description, state: "pending" });

    this.publish(chat);

    return new Promise((resolve) => chat.approvals.set(itemId, resolve));
  }

  private resolveApproval(chat: ChatRecord, itemId: string, approved: boolean) {
    const resolve = chat.approvals.get(itemId);

    if (resolve) {
      chat.approvals.delete(itemId);
      this.update(chat, itemId, { state: approved ? "approved" : "rejected" });
      resolve(approved);
    }
  }

  private rejectApprovals(chat: ChatRecord) {
    for (const itemId of [...chat.approvals.keys()]) {
      this.resolveApproval(chat, itemId, false);
    }
  }

  private add(chat: ChatRecord, item: NewAiChatItem): string {
    const id = item.id ?? newItemId();

    chat.items.push({ ...item, id } as AiChatItem);

    return id;
  }

  private update(chat: ChatRecord, itemId: string, changes: Partial<AiChatItem>) {
    chat.items = chat.items.map((item) => (item.id === itemId ? ({ ...item, ...changes } as AiChatItem) : item));
  }

  private snapshot(chat: ChatRecord): AiChatSnapshot {
    return {
      id: chat.id,
      clusterId: chat.clusterId,
      clusterName: chat.clusterName,
      placement: chat.placement,
      provider: chat.provider,
      model: chat.model,
      effort: chat.effort,
      allowChanges: chat.allowChanges,
      running: chat.running,
      items: [...chat.items],
    };
  }

  private publish(chat: ChatRecord) {
    this.dependencies.sendSnapshot(this.snapshot(chat));
  }
}
