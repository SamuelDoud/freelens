/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getMessageChannelListenerInjectable, requestFromChannelInjectionToken } from "@freelensapp/messaging";
import currentlyInClusterFrameInjectable from "../../../renderer/routes/currently-in-cluster-frame.injectable";
import { aiToolCallChannel, aiToolResultChannel } from "../common/channels";
import aiChatTurnsInjectable from "./chat-turns.injectable";
import aiChatsInjectable from "./chats.injectable";

// The tool calls of the command-line agents run in the frame that holds the chat, with its view and
// the user's credentials for its cluster.
const aiToolCallListenerInjectable = getMessageChannelListenerInjectable({
  id: "ai-chat",
  channel: aiToolCallChannel,
  getHandler: (di) => {
    const inClusterFrame = di.inject(currentlyInClusterFrameInjectable);
    const requestFromChannel = di.inject(requestFromChannelInjectionToken);

    return async ({ callId, chatId, name, args }) => {
      const chat = inClusterFrame ? di.inject(aiChatsInjectable).byId(chatId) : undefined;

      if (chat) {
        const result = await di.inject(aiChatTurnsInjectable).executeTool(chat, name, args);

        await requestFromChannel(aiToolResultChannel, { callId, result });
      }
    };
  },
});

export default aiToolCallListenerInjectable;
