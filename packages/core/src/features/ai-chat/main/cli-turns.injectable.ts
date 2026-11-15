/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { loggerInjectionToken } from "@freelensapp/logger";
import { getInjectable } from "@ogre-tools/injectable";
import aiCliHostInjectable from "./cli-host.injectable";
import { AiCliTurns } from "./cli-turns";

// Creating it has no side effects: processes start only with a turn, on the host of the CLIs.
const aiCliTurnsInjectable = getInjectable({
  id: "ai-chat-cli-turns",
  instantiate: (di) => {
    const logger = di.inject(loggerInjectionToken);

    return new AiCliTurns({
      host: di.inject(aiCliHostInjectable),
      logInfo: (message) => logger.info(message),
    });
  },
});

export default aiCliTurnsInjectable;
