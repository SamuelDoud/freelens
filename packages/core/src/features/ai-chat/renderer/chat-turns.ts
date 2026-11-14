/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { runInAction } from "mobx";
import { defaultAiSystemPrompt } from "../common/default-system-prompt";
import { getAvailableAiTools } from "../common/tools";
import { runOpenAiTurn } from "./openai-agent";

import type { AiToolResult, StartAiCliTurn, StartAiCliTurnResult } from "../common/channels";
import type { AiCliEvent } from "../common/cli-events";
import type { AiChatPreferences } from "../common/preferences";
import type { AiChat } from "./chat";
import type { AiToolExecutor } from "./tool-executor";

export interface AiChatTurnsDependencies {
  preferences: () => AiChatPreferences;
  clusterName: () => string;
  executor: AiToolExecutor;
  startCliTurn: (turn: StartAiCliTurn) => Promise<StartAiCliTurnResult>;
  stopCliTurn: (chatId: string) => Promise<void>;
  setAllowChanges: (chatId: string, allowChanges: boolean) => Promise<void>;
  /** Posts to the OpenAI-compatible server's chat completions. */
  postOpenAi: (body: Record<string, unknown>, signal: AbortSignal) => Promise<unknown>;
}

const describeError = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Sends the user's messages to the chat's backend and runs the tools it calls. */
export class AiChatTurns {
  constructor(private readonly dependencies: AiChatTurnsDependencies) {}

  systemPrompt(): string {
    const custom = this.dependencies.preferences().systemPrompt.trim();

    return `${custom || defaultAiSystemPrompt}\n\nThe cluster open in Freelens is "${this.dependencies.clusterName()}".`;
  }

  async send(chat: AiChat, prompt: string) {
    const text = prompt.trim();

    if (!text || chat.running) {
      return;
    }

    runInAction(() => {
      chat.add({ kind: "user", text });
      chat.running = true;
    });

    const preferences = this.dependencies.preferences();

    if (chat.provider === "openai") {
      const abortController = new AbortController();

      chat.abortController = abortController;

      try {
        await runOpenAiTurn(
          {
            systemPrompt: this.systemPrompt(),
            history: chat.openAiHistory,
            prompt: text,
            model: chat.model,
            effort: chat.effort,
          },
          {
            post: (body) => this.dependencies.postOpenAi(body, abortController.signal),
            execute: (name, args) => this.executeTool(chat, name, args),
            tools: () => getAvailableAiTools(chat.allowChanges),
            onText: (answer) => chat.add({ kind: "assistant", text: answer }),
            isStopped: () => abortController.signal.aborted,
          },
        );
      } catch (error) {
        if (!abortController.signal.aborted) {
          chat.add({ kind: "notice", tone: "error", text: describeError(error) });
        }
      } finally {
        runInAction(() => {
          chat.running = false;
          chat.abortController = undefined;
        });
      }

      return;
    }

    const result = await this.dependencies.startCliTurn({
      chatId: chat.id,
      provider: chat.provider,
      command: chat.provider === "claude" ? preferences.claudePath : preferences.codexPath,
      prompt: text,
      model: chat.model,
      effort: chat.effort,
      systemPrompt: this.systemPrompt(),
      resumeSessionId: chat.sessions.get(chat.provider),
      allowChanges: chat.allowChanges,
    });

    if (!result.ok) {
      runInAction(() => {
        chat.add({ kind: "notice", tone: "error", text: result.error });
        chat.running = false;
      });
    }
  }

  /** What a command-line agent reported for one of this frame's chats. */
  applyCliEvent(chat: AiChat, event: AiCliEvent) {
    runInAction(() => {
      switch (event.kind) {
        case "session":
          chat.sessions.set(chat.provider, event.sessionId);
          break;
        case "text":
          chat.add({ kind: "assistant", text: event.text });
          break;
        case "done":
          chat.rejectPendingApprovals();
          chat.running = false;

          if (event.error) {
            chat.add({ kind: "notice", tone: "error", text: event.error });
          }
          break;
        // Tool calls are shown as they are run, by executeTool.
        default:
          break;
      }
    });
  }

  async executeTool(chat: AiChat, name: string, args: unknown): Promise<AiToolResult> {
    const id = chat.add({ kind: "tool", name, args, status: "running" });
    const result = await this.dependencies.executor.execute(name, args, {
      allowChanges: () => chat.allowChanges,
      approve: (description) =>
        this.dependencies.preferences().askBeforeEachChange ? chat.requestApproval(description) : Promise.resolve(true),
    });

    chat.update(id, { status: result.ok ? "done" : "failed", output: result.text });

    return result;
  }

  async stop(chat: AiChat) {
    chat.rejectPendingApprovals();

    if (chat.provider === "openai") {
      chat.abortController?.abort();
      runInAction(() => {
        chat.running = false;
      });
    } else {
      await this.dependencies.stopCliTurn(chat.id);
    }
  }

  async setAllowChanges(chat: AiChat, allowChanges: boolean) {
    runInAction(() => {
      chat.allowChanges = allowChanges;
    });
    await this.dependencies.setAllowChanges(chat.id, allowChanges);
  }
}
