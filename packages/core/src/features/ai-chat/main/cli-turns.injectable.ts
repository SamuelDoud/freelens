/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { loggerInjectionToken } from "@freelensapp/logger";
import { sendMessageToChannelInjectionToken } from "@freelensapp/messaging";
import { getInjectable } from "@ogre-tools/injectable";
import spawnInjectable from "../../../main/child-process/spawn.injectable";
import { aiCliEventChannel } from "../common/channels";
import { AiCliTurns } from "./cli-turns";
import aiMcpServerInjectable from "./mcp-server.injectable";

// Creating it has no side effects: processes start only with a turn, through the spawn injectable.
const aiCliTurnsInjectable = getInjectable({
  id: "ai-chat-cli-turns",
  instantiate: (di) => {
    const sendMessageToChannel = di.inject(sendMessageToChannelInjectionToken);
    const logger = di.inject(loggerInjectionToken);

    return new AiCliTurns({
      spawn: di.inject(spawnInjectable),
      mcpServer: di.inject(aiMcpServerInjectable),
      sendEvent: (chatId, event) => sendMessageToChannel(aiCliEventChannel, { chatId, event }),
      // Read at each turn: the shell sync replaces process.env once the login shell's environment is known.
      env: () => process.env,
      logInfo: (message) => logger.info(message),
    });
  },
});

export default aiCliTurnsInjectable;
