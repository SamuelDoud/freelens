/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getRequestChannelListenerInjectable } from "@freelensapp/messaging";
import { setAiChatAllowChangesChannel } from "../common/channels";
import aiMcpServerInjectable from "./mcp-server.injectable";

const setAiChatAllowChangesListenerInjectable = getRequestChannelListenerInjectable({
  id: "ai-chat-set-allow-changes-listener",
  channel: setAiChatAllowChangesChannel,
  getHandler: (di) => {
    const mcpServer = di.inject(aiMcpServerInjectable);

    return ({ chatId, allowChanges }) => mcpServer.setAllowChanges(chatId, allowChanges);
  },
});

export default setAiChatAllowChangesListenerInjectable;
