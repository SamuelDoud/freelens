/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getRequestChannelListenerInjectable } from "@freelensapp/messaging";
import { aiToolResultChannel } from "../common/channels";
import aiChatHostInjectable from "./chat-host.injectable";

const aiToolResultListenerInjectable = getRequestChannelListenerInjectable({
  id: "ai-chat-tool-result-listener",
  channel: aiToolResultChannel,
  getHandler:
    (di) =>
    ({ callId, result }) =>
      di.inject(aiChatHostInjectable).resolveToolResult(callId, result),
});

export default aiToolResultListenerInjectable;
