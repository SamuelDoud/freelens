/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { navigateToRouteInjectionToken } from "../../../../navigate-to-route-injection-token";
import csiDriversRouteInjectable from "./csi-drivers-route.injectable";

const navigateToCSIDriversInjectable = getInjectable({
  id: "navigate-to-csi-drivers",

  instantiate: (di) => {
    const navigateToRoute = di.inject(navigateToRouteInjectionToken);
    const route = di.inject(csiDriversRouteInjectable);

    return () => navigateToRoute(route);
  },
});

export default navigateToCSIDriversInjectable;
