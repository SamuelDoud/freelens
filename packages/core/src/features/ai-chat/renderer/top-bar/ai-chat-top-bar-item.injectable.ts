/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import clusterViewRouteParametersInjectable from "../../../../renderer/components/cluster-manager/cluster-view-route-parameters.injectable";
import { topBarItemOnRightSideInjectionToken } from "../../../../renderer/components/layout/top-bar/top-bar-items/top-bar-item-injection-token";
import { AiChatTopBarButton } from "./ai-chat-top-bar-button";

/** Shown whenever a cluster is open in the window. */
const aiChatTopBarItemInjectable = getInjectable({
  id: "ai-chat-top-bar-item",
  instantiate: (di) => {
    const routeParameters = di.inject(clusterViewRouteParametersInjectable);

    return {
      id: "ai-chat",
      isShown: computed(() => Boolean(routeParameters.clusterId.get())),
      orderNumber: 5,
      Component: AiChatTopBarButton,
    };
  },
  injectionToken: topBarItemOnRightSideInjectionToken,
});

export default aiChatTopBarItemInjectable;
