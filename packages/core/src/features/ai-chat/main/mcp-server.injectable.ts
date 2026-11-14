/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { loggerInjectionToken } from "@freelensapp/logger";
import { getInjectable } from "@ogre-tools/injectable";
import aiChatHostInjectable from "./chat-host.injectable";
import { AiMcpServer } from "./mcp-server";

// Creating it has no side effects: the server listens only when a chat first asks for its URL.
const aiMcpServerInjectable = getInjectable({
  id: "ai-chat-mcp-server",
  instantiate: (di) => {
    const logger = di.inject(loggerInjectionToken);
    // Injected on use: the host injects this server too.
    const host = () => di.inject(aiChatHostInjectable);

    return new AiMcpServer({
      allowsChanges: (chatId) => host().allowsChanges(chatId),
      callTool: (chatId, name, args) => host().callTool(chatId, name, args),
      logError: (message, error) => logger.error(message, error),
    });
  },
});

export default aiMcpServerInjectable;
