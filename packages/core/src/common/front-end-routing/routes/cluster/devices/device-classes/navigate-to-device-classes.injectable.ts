/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { navigateToRouteInjectionToken } from "../../../../navigate-to-route-injection-token";
import deviceClassesRouteInjectable from "./device-classes-route.injectable";

const navigateToDeviceClassesInjectable = getInjectable({
  id: "navigate-to-device-classes",

  instantiate: (di) => {
    const navigateToRoute = di.inject(navigateToRouteInjectionToken);
    const route = di.inject(deviceClassesRouteInjectable);

    return () => navigateToRoute(route);
  },
});

export default navigateToDeviceClassesInjectable;
