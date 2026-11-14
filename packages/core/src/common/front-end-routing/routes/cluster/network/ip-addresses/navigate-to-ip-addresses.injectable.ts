/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { navigateToRouteInjectionToken } from "../../../../navigate-to-route-injection-token";
import ipAddressesRouteInjectable from "./ip-addresses-route.injectable";

const navigateToIPAddressesInjectable = getInjectable({
  id: "navigate-to-ip-addresses",

  instantiate: (di) => {
    const navigateToRoute = di.inject(navigateToRouteInjectionToken);
    const route = di.inject(ipAddressesRouteInjectable);

    return () => navigateToRoute(route);
  },
});

export default navigateToIPAddressesInjectable;
