/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { navigateToRouteInjectionToken } from "../../../../navigate-to-route-injection-token";
import csiNodesRouteInjectable from "./csi-nodes-route.injectable";

const navigateToCSINodesInjectable = getInjectable({
  id: "navigate-to-csi-nodes",

  instantiate: (di) => {
    const navigateToRoute = di.inject(navigateToRouteInjectionToken);
    const route = di.inject(csiNodesRouteInjectable);

    return () => navigateToRoute(route);
  },
});

export default navigateToCSINodesInjectable;
