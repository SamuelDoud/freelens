/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { loggerInjectionToken } from "@freelensapp/logger";
import { sendMessageToChannelInjectionToken } from "@freelensapp/messaging";
import { getInjectable } from "@ogre-tools/injectable";
import { aiToolCallChannel } from "../common/channels";
import { AiMcpServer } from "./mcp-server";

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
  causesSideEffects: true,
});

export default aiMcpServerInjectable;
