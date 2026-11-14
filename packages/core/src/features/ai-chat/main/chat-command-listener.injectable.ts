/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getRequestChannelListenerInjectable } from "@freelensapp/messaging";
import { aiChatCommandChannel } from "../common/channels";
import aiChatHostInjectable from "./chat-host.injectable";

const aiChatCommandListenerInjectable = getRequestChannelListenerInjectable({
  id: "ai-chat-command-listener",
  channel: aiChatCommandChannel,
  getHandler: (di) => (command) => di.inject(aiChatHostInjectable).command(command),
});

export default aiChatCommandListenerInjectable;
