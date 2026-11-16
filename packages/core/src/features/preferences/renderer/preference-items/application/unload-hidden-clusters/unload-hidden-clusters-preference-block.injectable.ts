/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { preferenceItemInjectionToken } from "../../preference-item-injection-token";
import { UnloadHiddenClusters } from "./unload-hidden-clusters";

const unloadHiddenClustersPreferenceBlockInjectable = getInjectable({
  id: "unload-hidden-clusters-preference-block",

  instantiate: () => ({
    kind: "block" as const,
    id: "unload-hidden-clusters",
    parentId: "application-page",
    orderNumber: 36,
    Component: UnloadHiddenClusters,
  }),

  injectionToken: preferenceItemInjectionToken,
});

export default unloadHiddenClustersPreferenceBlockInjectable;
