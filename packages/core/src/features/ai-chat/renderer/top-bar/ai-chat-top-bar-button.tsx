/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { requestFromChannelInjectionToken } from "@freelensapp/messaging";
import { withInjectables } from "@ogre-tools/injectable-react";
import { runInAction } from "mobx";
import { observer } from "mobx-react";
import clusterViewRouteParametersInjectable from "../../../../renderer/components/cluster-manager/cluster-view-route-parameters.injectable";
import getClusterByIdInjectable from "../../../cluster/storage/common/get-by-id.injectable";
import userPreferencesStateInjectable from "../../../user-preferences/common/state.injectable";
import { createAiChatChannel } from "../../common/channels";
import { defaultAiChatPreferences } from "../../common/preferences";
import { AiChatButton } from "../ai-chat-button";

interface Dependencies {
  openChat: () => void;
}

const NonInjectedAiChatTopBarButton = observer(({ openChat }: Dependencies) => (
  <AiChatButton data-testid="top-bar-ai-chat-button" onClick={openChat} />
));

/** The robot in the window's top bar: opens a chat about the cluster open in the window. */
export const AiChatTopBarButton = withInjectables<Dependencies>(NonInjectedAiChatTopBarButton, {
  getProps: (di, props) => {
    const routeParameters = di.inject(clusterViewRouteParametersInjectable);
    const getClusterById = di.inject(getClusterByIdInjectable);
    const requestFromChannel = di.inject(requestFromChannelInjectionToken);
    const state = di.inject(userPreferencesStateInjectable);

    return {
      ...props,
      openChat: () => {
        const clusterId = routeParameters.clusterId.get();
        const cluster = clusterId ? getClusterById(clusterId) : undefined;

        if (!cluster) {
          return;
        }

        runInAction(() => {
          state.aiChat = { ...(state.aiChat ?? defaultAiChatPreferences), discovered: true };
        });
        void requestFromChannel(createAiChatChannel, { clusterId: cluster.id, clusterName: cluster.name.get() });
      },
    };
  },
});
