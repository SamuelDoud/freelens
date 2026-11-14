/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { navigateToRouteInjectionToken } from "../../../../navigate-to-route-injection-token";
import serviceCidrsRouteInjectable from "./service-cidrs-route.injectable";

const navigateToServiceCIDRsInjectable = getInjectable({
  id: "navigate-to-service-cidrs",

  instantiate: (di) => {
    const navigateToRoute = di.inject(navigateToRouteInjectionToken);
    const route = di.inject(serviceCidrsRouteInjectable);

    return () => navigateToRoute(route);
  },
});

export default navigateToServiceCIDRsInjectable;
