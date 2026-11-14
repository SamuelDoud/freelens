/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import aiChatTurnsInjectable from "./chat-turns.injectable";
import aiChatsInjectable from "./chats.injectable";

/** Closing a chat's tab stops its turn and forgets the conversation. */
const clearAiChatTabDataInjectable = getInjectable({
  id: "clear-ai-chat-tab-data",
  instantiate: (di) => {
    const chats = di.inject(aiChatsInjectable);

    return (tabId: string) => {
      const chat = chats.remove(tabId);

      if (chat?.running) {
        // Injected only now: the turns need the cluster's API, which a test of the dock may not have.
        void di.inject(aiChatTurnsInjectable).stop(chat);
      }
    };
  },
});

export default clearAiChatTabDataInjectable;
