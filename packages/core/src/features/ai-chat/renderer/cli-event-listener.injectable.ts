/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getMessageChannelListenerInjectable } from "@freelensapp/messaging";
import currentlyInClusterFrameInjectable from "../../../renderer/routes/currently-in-cluster-frame.injectable";
import { aiCliEventChannel } from "../common/channels";
import aiChatTurnsInjectable from "./chat-turns.injectable";
import aiChatsInjectable from "./chats.injectable";

// Every frame hears every chat's events; only the frame that holds the chat acts on them. The
// chats are injected on first use, as the root frame has no cluster to run their tools against.
const aiCliEventListenerInjectable = getMessageChannelListenerInjectable({
  id: "ai-chat",
  channel: aiCliEventChannel,
  getHandler: (di) => {
    const inClusterFrame = di.inject(currentlyInClusterFrameInjectable);

    return ({ chatId, event }) => {
      const chat = inClusterFrame ? di.inject(aiChatsInjectable).byId(chatId) : undefined;

      if (chat) {
        di.inject(aiChatTurnsInjectable).applyCliEvent(chat, event);
      }
    };
  },
});

export default aiCliEventListenerInjectable;
