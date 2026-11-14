/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { navigateToRouteInjectionToken } from "../../../../navigate-to-route-injection-token";
import deviceTaintRulesRouteInjectable from "./device-taint-rules-route.injectable";

const navigateToDeviceTaintRulesInjectable = getInjectable({
  id: "navigate-to-device-taint-rules",

  instantiate: (di) => {
    const navigateToRoute = di.inject(navigateToRouteInjectionToken);
    const route = di.inject(deviceTaintRulesRouteInjectable);

    return () => navigateToRoute(route);
  },
});

export default navigateToDeviceTaintRulesInjectable;
