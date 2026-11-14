/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { loggerInjectionToken } from "@freelensapp/logger";
import { sendMessageToChannelInjectionToken } from "@freelensapp/messaging";
import { getInjectable } from "@ogre-tools/injectable";
import platformInjectable from "../../../common/vars/platform.injectable";
import spawnInjectable from "../../../main/child-process/spawn.injectable";
import userPreferencesStateInjectable from "../../user-preferences/common/state.injectable";
import { aiDiscoveryChangedChannel } from "../common/channels";
import { defaultAiChatPreferences } from "../common/preferences";
import { AiCliDiscovery } from "./cli-discovery";
import { aiWorkDir } from "./work-dir";

// Creating it has no side effects: the CLIs are asked only on refresh.
const aiCliDiscoveryInjectable = getInjectable({
  id: "ai-chat-cli-discovery",
  instantiate: (di) => {
    const logger = di.inject(loggerInjectionToken);
    const state = di.inject(userPreferencesStateInjectable);
    const sendMessageToChannel = di.inject(sendMessageToChannelInjectionToken);
    const discovery = new AiCliDiscovery({
      spawn: di.inject(spawnInjectable),
      env: () => process.env,
      configuredPaths: () => {
        const preferences = state.aiChat ?? defaultAiChatPreferences;

        return { claude: preferences.claudePath, codex: preferences.codexPath, muse: preferences.musePath };
      },
      workDir: () => aiWorkDir().workDir,
      platform: di.inject(platformInjectable),
      logWarn: (message) => logger.warn(message),
    });

    discovery.onChange((current) => sendMessageToChannel(aiDiscoveryChangedChannel, current));

    return discovery;
  },
});

export default aiCliDiscoveryInjectable;
