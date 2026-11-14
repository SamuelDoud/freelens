/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getRequestChannelListenerInjectable } from "@freelensapp/messaging";
import { createAiChatChannel } from "../common/channels";
import aiChatHostInjectable from "./chat-host.injectable";

const createAiChatListenerInjectable = getRequestChannelListenerInjectable({
  id: "ai-chat-create-listener",
  channel: createAiChatChannel,
  getHandler: (di) => (request) => di.inject(aiChatHostInjectable).create(request),
});

export default createAiChatListenerInjectable;
