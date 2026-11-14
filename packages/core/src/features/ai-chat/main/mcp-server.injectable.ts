/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { loggerInjectionToken } from "@freelensapp/logger";
import { sendMessageToChannelInjectionToken } from "@freelensapp/messaging";
import { getInjectable } from "@ogre-tools/injectable";
import { aiToolCallChannel } from "../common/channels";
import { AiMcpServer } from "./mcp-server";

// Creating it has no side effects: the server listens only when a chat first asks for its URL.
const aiMcpServerInjectable = getInjectable({
  id: "ai-chat-mcp-server",
  instantiate: (di) => {
    const sendMessageToChannel = di.inject(sendMessageToChannelInjectionToken);
    const logger = di.inject(loggerInjectionToken);

    return new AiMcpServer({
      sendToolCall: (call) => sendMessageToChannel(aiToolCallChannel, call),
      logError: (message, error) => logger.error(message, error),
    });
  },
});

export default aiMcpServerInjectable;
