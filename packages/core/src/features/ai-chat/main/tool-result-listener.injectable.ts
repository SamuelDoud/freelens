/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getRequestChannelListenerInjectable } from "@freelensapp/messaging";
import { aiToolResultChannel } from "../common/channels";
import aiMcpServerInjectable from "./mcp-server.injectable";

const aiToolResultListenerInjectable = getRequestChannelListenerInjectable({
  id: "ai-chat-tool-result-listener",
  channel: aiToolResultChannel,
  getHandler: (di) => {
    const mcpServer = di.inject(aiMcpServerInjectable);

    return ({ callId, result }) => mcpServer.resolveToolCall(callId, result);
  },
});

export default aiToolResultListenerInjectable;
