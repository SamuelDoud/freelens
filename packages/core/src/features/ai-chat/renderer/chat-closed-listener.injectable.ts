/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getMessageChannelListenerInjectable } from "@freelensapp/messaging";
import { aiChatClosedChannel } from "../common/channels";
import aiChatMirrorInjectable from "./chat-mirror.injectable";

const aiChatClosedListenerInjectable = getMessageChannelListenerInjectable({
  id: "ai-chat-mirror",
  channel: aiChatClosedChannel,
  getHandler:
    (di) =>
    ({ chatId }) =>
      di.inject(aiChatMirrorInjectable).remove(chatId),
});

export default aiChatClosedListenerInjectable;
