/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getRequestChannelListenerInjectable } from "@freelensapp/messaging";
import { getAiChatChannel } from "../common/channels";
import aiChatHostInjectable from "./chat-host.injectable";

const getAiChatListenerInjectable = getRequestChannelListenerInjectable({
  id: "ai-chat-get-listener",
  channel: getAiChatChannel,
  getHandler:
    (di) =>
    ({ chatId }) =>
      di.inject(aiChatHostInjectable).get(chatId),
});

export default getAiChatListenerInjectable;
