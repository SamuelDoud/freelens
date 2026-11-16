/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { requestFromChannelInjectionToken } from "@freelensapp/messaging";
import { getInjectable } from "@ogre-tools/injectable";
import { action, observable } from "mobx";
import { aiChatCommandChannel, createAiChatChannel, getAiChatChannel, listAiChatsChannel } from "../common/channels";
import { applyAiChatDelta } from "../common/chat-delta";

import type { AiChatCommand, CreateAiChat } from "../common/channels";
import type { AiChatStateMessage } from "../common/chat-delta";
import type { AiChatSnapshot } from "../common/chat-state";

/** This frame's copy of the chats the main process holds, kept current by its messages. */
export class AiChatMirror {
  readonly chats = observable.map<string, AiChatSnapshot>([], { deep: false });

  constructor(
    private readonly dependencies: {
      list: (clusterId?: string) => Promise<AiChatSnapshot[]>;
      get: (chatId: string) => Promise<AiChatSnapshot | undefined>;
      create: (request: CreateAiChat) => Promise<AiChatSnapshot>;
      command: (command: AiChatCommand) => Promise<void>;
    },
  ) {}

  /** Loads the chats of a cluster, or of all clusters, as they are now. */
  async load(clusterId?: string) {
    const chats = await this.dependencies.list(clusterId);

    action(() => {
      for (const chat of chats) {
        this.update(chat);
      }
    })();
  }

  /** The chats a snapshot was asked for and has not come yet, so that a burst of changes asks once. */
  private readonly resyncing = new Set<string>();

  /** A snapshot is kept unless the chat is already past it: a delta may have come first. */
  readonly update = action((snapshot: AiChatSnapshot) => {
    const current = this.chats.get(snapshot.id);

    if (!current || snapshot.seq >= current.seq) {
      this.chats.set(snapshot.id, snapshot);
    }
  });

  /**
   * What the main process sent about a chat. A change the chat does not follow, because one was
   * missed or the chat is not known yet, is not applied: the whole chat is asked for instead.
   */
  readonly receive = action((message: AiChatStateMessage) => {
    if (message.kind === "snapshot") {
      this.update(message.snapshot);

      return;
    }

    const { delta } = message;
    const current = this.chats.get(delta.chatId);
    const next = current && applyAiChatDelta(current, delta);

    if (next) {
      if (next !== current) {
        this.chats.set(delta.chatId, next);
      }

      return;
    }

    void this.resync(delta.chatId);
  });

  private async resync(chatId: string) {
    if (this.resyncing.has(chatId)) {
      return;
    }

    this.resyncing.add(chatId);

    try {
      const snapshot = await this.dependencies.get(chatId);

      if (snapshot) {
        this.update(snapshot);
      }
    } catch {
      // The next change asks again.
    } finally {
      this.resyncing.delete(chatId);
    }
  }

  readonly remove = action((chatId: string) => {
    this.chats.delete(chatId);
  });

  get(chatId: string) {
    return this.chats.get(chatId);
  }

  forCluster(clusterId: string, placement?: AiChatSnapshot["placement"]) {
    return [...this.chats.values()].filter(
      (chat) => chat.clusterId === clusterId && (placement === undefined || chat.placement === placement),
    );
  }

  async create(request: CreateAiChat) {
    const snapshot = await this.dependencies.create(request);

    this.update(snapshot);

    return snapshot;
  }

  command(command: AiChatCommand) {
    return this.dependencies.command(command);
  }
}

const aiChatMirrorInjectable = getInjectable({
  id: "ai-chat-mirror",
  instantiate: (di) => {
    const requestFromChannel = di.inject(requestFromChannelInjectionToken);

    return new AiChatMirror({
      list: (clusterId) => requestFromChannel(listAiChatsChannel, { clusterId }),
      get: (chatId) => requestFromChannel(getAiChatChannel, { chatId }),
      create: (request) => requestFromChannel(createAiChatChannel, request),
      command: (command) => requestFromChannel(aiChatCommandChannel, command),
    });
  },
});

export default aiChatMirrorInjectable;
