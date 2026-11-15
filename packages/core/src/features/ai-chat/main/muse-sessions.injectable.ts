/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { loggerInjectionToken } from "@freelensapp/logger";
import { getInjectable } from "@ogre-tools/injectable";
import aiCliHostInjectable from "./cli-host.injectable";
import { AiMuseSessions } from "./muse-acp";

// Creating it has no side effects: Muse starts only with a chat's first turn.
const aiMuseSessionsInjectable = getInjectable({
  id: "ai-chat-muse-sessions",
  instantiate: (di) => {
    const logger = di.inject(loggerInjectionToken);

    return new AiMuseSessions({
      host: di.inject(aiCliHostInjectable),
      logWarn: (message) => logger.warn(message),
    });
  },
});

export default aiMuseSessionsInjectable;
