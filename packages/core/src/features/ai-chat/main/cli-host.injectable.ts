/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { homedir } from "node:os";
import path from "node:path";
import { loggerInjectionToken } from "@freelensapp/logger";
import { getInjectable } from "@ogre-tools/injectable";
import platformInjectable from "../../../common/vars/platform.injectable";
import spawnInjectable from "../../../main/child-process/spawn.injectable";
import userPreferencesStateInjectable from "../../user-preferences/common/state.injectable";
import { defaultAiChatPreferences } from "../common/preferences";
import { LocalCliHost } from "./cli-host";
import { createCliHostSelector } from "./select-cli-host";
import aiSshAskpassInjectable from "./ssh/ssh-askpass.injectable";
import { SshCliHost } from "./ssh/ssh-cli-host";

import type { AiCliHost } from "./cli-host";

/** Where the CLIs run, as the preferences say now: this computer, or another host over SSH. */
export type GetAiCliHost = () => AiCliHost;

// Creating it has no side effects: a remote host is connected to only when a turn or a refresh needs it.
const aiCliHostInjectable = getInjectable({
  id: "ai-chat-cli-host",
  instantiate: (di): GetAiCliHost => {
    const state = di.inject(userPreferencesStateInjectable);
    const spawn = di.inject(spawnInjectable);
    const logger = di.inject(loggerInjectionToken);
    // Read at each use: the shell sync replaces process.env once the login shell's environment is known.
    const env = () => process.env;
    const platform = di.inject(platformInjectable);
    const local = new LocalCliHost({ spawn, env, platform });

    return createCliHostSelector({
      preferences: () => state.aiChat ?? defaultAiChatPreferences,
      local,
      createRemote: (remoteHost) =>
        new SshCliHost(remoteHost, {
          spawn,
          env,
          askpass: di.inject(aiSshAskpassInjectable),
          // Short: the path of a socket is limited to about a hundred characters.
          controlDir: path.join(homedir(), ".freelens-ssh"),
          platform,
          logInfo: (message) => logger.info(message),
        }),
    });
  },
});

export default aiCliHostInjectable;
