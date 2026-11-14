/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { chatIdOfTab } from "./ai-chat-dock-tab";
import aiChatMirrorInjectable from "./chat-mirror.injectable";

/**
 * Closing a chat's dock tab closes the chat, unless the tab closes because the chat moved to the
 * right panel or a window.
 */
const clearAiChatTabDataInjectable = getInjectable({
  id: "clear-ai-chat-tab-data",
  instantiate: (di) => {
    const mirror = di.inject(aiChatMirrorInjectable);

    return (tabId: string) => {
      const chatId = chatIdOfTab(tabId);
      const chat = chatId ? mirror.get(chatId) : undefined;

      if (chat?.placement === "bottom") {
        void mirror.command({ type: "close", chatId: chat.id });
      }
    };
  },
});

export default clearAiChatTabDataInjectable;
