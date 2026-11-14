/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { runInAction } from "mobx";
import hostedClusterInjectable from "../../../renderer/cluster-frame-context/hosted-cluster.injectable";
import userPreferencesStateInjectable from "../../user-preferences/common/state.injectable";
import { defaultAiChatPreferences } from "../common/preferences";
import aiChatMirrorInjectable from "./chat-mirror.injectable";

import type { AiChatPlacement } from "../common/preferences";

export type OpenAiChat = (placement?: AiChatPlacement) => Promise<void>;

/** Opens a new chat about this cluster frame's cluster, where the user last put a chat or where asked. */
const openAiChatInjectable = getInjectable({
  id: "open-ai-chat",
  instantiate: (di): OpenAiChat => {
    const mirror = di.inject(aiChatMirrorInjectable);
    const state = di.inject(userPreferencesStateInjectable);

    return async (placement) => {
      const cluster = di.inject(hostedClusterInjectable);

      if (!cluster) {
        return;
      }

      // Opening a chat at all is what the glowing robot buttons wait for.
      runInAction(() => {
        state.aiChat = { ...(state.aiChat ?? defaultAiChatPreferences), discovered: true };
      });

      await mirror.create({ clusterId: cluster.id, clusterName: cluster.name.get(), placement });
    };
  },
});

export default openAiChatInjectable;
