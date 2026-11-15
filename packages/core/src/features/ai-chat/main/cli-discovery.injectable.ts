/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { loggerInjectionToken } from "@freelensapp/logger";
import { sendMessageToChannelInjectionToken } from "@freelensapp/messaging";
import { getInjectable } from "@ogre-tools/injectable";
import userPreferencesStateInjectable from "../../user-preferences/common/state.injectable";
import { aiDiscoveryChangedChannel } from "../common/channels";
import { defaultAiChatPreferences } from "../common/preferences";
import { AiCliDiscovery } from "./cli-discovery";
import aiCliHostInjectable from "./cli-host.injectable";

// Creating it has no side effects: the CLIs are asked only on refresh.
const aiCliDiscoveryInjectable = getInjectable({
  id: "ai-chat-cli-discovery",
  instantiate: (di) => {
    const logger = di.inject(loggerInjectionToken);
    const state = di.inject(userPreferencesStateInjectable);
    const sendMessageToChannel = di.inject(sendMessageToChannelInjectionToken);
    const discovery = new AiCliDiscovery({
      host: di.inject(aiCliHostInjectable),
      configuredPaths: () => {
        const preferences = state.aiChat ?? defaultAiChatPreferences;

        return { claude: preferences.claudePath, codex: preferences.codexPath, muse: preferences.musePath };
      },
      logWarn: (message) => logger.warn(message),
    });

    discovery.onChange((current) => sendMessageToChannel(aiDiscoveryChangedChannel, current));

    return discovery;
  },
});

export default aiCliDiscoveryInjectable;
