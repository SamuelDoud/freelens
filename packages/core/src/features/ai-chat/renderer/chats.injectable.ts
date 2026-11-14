/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import userPreferencesStateInjectable from "../../user-preferences/common/state.injectable";
import { defaultAiChatPreferences } from "../common/preferences";
import { AiChat } from "./chat";

/** The chats of this cluster frame, by dock tab and by chat id. */
export class AiChats {
  private readonly byTab = new Map<string, AiChat>();
  private readonly byChatId = new Map<string, AiChat>();

  constructor(private readonly createChat: () => AiChat) {}

  forTab(tabId: string): AiChat {
    let chat = this.byTab.get(tabId);

    if (!chat) {
      chat = this.createChat();
      this.byTab.set(tabId, chat);
      this.byChatId.set(chat.id, chat);
    }

    return chat;
  }

  byId(chatId: string): AiChat | undefined {
    return this.byChatId.get(chatId);
  }

  /** Forgets the chat of a closed tab. */
  remove(tabId: string): AiChat | undefined {
    const chat = this.byTab.get(tabId);

    if (chat) {
      this.byTab.delete(tabId);
      this.byChatId.delete(chat.id);
    }

    return chat;
  }
}

const aiChatsInjectable = getInjectable({
  id: "ai-chats",
  instantiate: (di) => {
    const state = di.inject(userPreferencesStateInjectable);

    return new AiChats(() => {
      const preferences = state.aiChat ?? defaultAiChatPreferences;
      const provider = preferences.defaultProvider;

      return new AiChat({
        provider,
        model: preferences.providers[provider].defaultModel,
        effort: preferences.providers[provider].defaultEffort,
      });
    });
  },
});

export default aiChatsInjectable;
