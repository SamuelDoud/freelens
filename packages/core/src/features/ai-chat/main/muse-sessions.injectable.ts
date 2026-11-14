/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { loggerInjectionToken } from "@freelensapp/logger";
import { getInjectable } from "@ogre-tools/injectable";
import spawnInjectable from "../../../main/child-process/spawn.injectable";
import { AiMuseSessions } from "./muse-acp";
import { aiWorkDir } from "./work-dir";

// Creating it has no side effects: Muse starts only with a chat's first turn.
const aiMuseSessionsInjectable = getInjectable({
  id: "ai-chat-muse-sessions",
  instantiate: (di) => {
    const logger = di.inject(loggerInjectionToken);

    return new AiMuseSessions({
      spawn: di.inject(spawnInjectable),
      env: () => process.env,
      workDir: () => aiWorkDir().workDir,
      emptyKubeconfig: () => aiWorkDir().emptyKubeconfig,
      logWarn: (message) => logger.warn(message),
    });
  },
});

export default aiMuseSessionsInjectable;
