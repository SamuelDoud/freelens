/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { requestFromChannelInjectionToken } from "@freelensapp/messaging";
import { getInjectable } from "@ogre-tools/injectable";
import hostedClusterInjectable from "../../../renderer/cluster-frame-context/hosted-cluster.injectable";
import userPreferencesStateInjectable from "../../user-preferences/common/state.injectable";
import { setAiChatAllowChangesChannel, startAiCliTurnChannel, stopAiCliTurnChannel } from "../common/channels";
import { defaultAiChatPreferences } from "../common/preferences";
import { AiChatTurns } from "./chat-turns";
import aiOpenAiEndpointInjectable from "./openai-endpoint.injectable";
import aiToolExecutorInjectable from "./tool-executor.injectable";

const aiChatTurnsInjectable = getInjectable({
  id: "ai-chat-turns",
  instantiate: (di) => {
    const requestFromChannel = di.inject(requestFromChannelInjectionToken);
    const state = di.inject(userPreferencesStateInjectable);
    const hostedCluster = di.inject(hostedClusterInjectable);
    const openAi = di.inject(aiOpenAiEndpointInjectable);

    return new AiChatTurns({
      preferences: () => state.aiChat ?? defaultAiChatPreferences,
      clusterName: () => hostedCluster?.name.get() ?? "",
      executor: di.inject(aiToolExecutorInjectable),
      startCliTurn: (turn) => requestFromChannel(startAiCliTurnChannel, turn),
      stopCliTurn: (chatId) => requestFromChannel(stopAiCliTurnChannel, { chatId }),
      setAllowChanges: (chatId, allowChanges) =>
        requestFromChannel(setAiChatAllowChangesChannel, { chatId, allowChanges }),
      postOpenAi: (body, signal) => openAi.postChat(body, signal),
    });
  },
});

export default aiChatTurnsInjectable;
