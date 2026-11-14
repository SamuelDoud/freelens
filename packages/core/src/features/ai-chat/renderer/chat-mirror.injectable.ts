/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { requestFromChannelInjectionToken } from "@freelensapp/messaging";
import { getInjectable } from "@ogre-tools/injectable";
import { action, observable } from "mobx";
import { aiChatCommandChannel, createAiChatChannel, listAiChatsChannel } from "../common/channels";

import type { AiChatCommand, CreateAiChat } from "../common/channels";
import type { AiChatSnapshot } from "../common/chat-state";

/** This frame's copy of the chats the main process holds, kept current by its messages. */
export class AiChatMirror {
  readonly chats = observable.map<string, AiChatSnapshot>([], { deep: false });

  constructor(
    private readonly dependencies: {
      list: (clusterId?: string) => Promise<AiChatSnapshot[]>;
      create: (request: CreateAiChat) => Promise<AiChatSnapshot>;
      command: (command: AiChatCommand) => Promise<void>;
    },
  ) {}

  /** Loads the chats of a cluster, or of all clusters, as they are now. */
  async load(clusterId?: string) {
    const chats = await this.dependencies.list(clusterId);

    action(() => {
      for (const chat of chats) {
        this.chats.set(chat.id, chat);
      }
    })();
  }

  readonly update = action((snapshot: AiChatSnapshot) => {
    this.chats.set(snapshot.id, snapshot);
  });

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
      create: (request) => requestFromChannel(createAiChatChannel, request),
      command: (command) => requestFromChannel(aiChatCommandChannel, command),
    });
  },
});

export default aiChatMirrorInjectable;
