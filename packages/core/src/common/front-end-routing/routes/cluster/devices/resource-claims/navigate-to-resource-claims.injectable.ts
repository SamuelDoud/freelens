/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { navigateToRouteInjectionToken } from "../../../../navigate-to-route-injection-token";
import resourceClaimsRouteInjectable from "./resource-claims-route.injectable";

const navigateToResourceClaimsInjectable = getInjectable({
  id: "navigate-to-resource-claims",

  instantiate: (di) => {
    const navigateToRoute = di.inject(navigateToRouteInjectionToken);
    const route = di.inject(resourceClaimsRouteInjectable);

    return () => navigateToRoute(route);
  },
});

export default navigateToResourceClaimsInjectable;
