/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { navigateToRouteInjectionToken } from "../../../../navigate-to-route-injection-token";
import resourceSlicesRouteInjectable from "./resource-slices-route.injectable";

const navigateToResourceSlicesInjectable = getInjectable({
  id: "navigate-to-resource-slices",

  instantiate: (di) => {
    const navigateToRoute = di.inject(navigateToRouteInjectionToken);
    const route = di.inject(resourceSlicesRouteInjectable);

    return () => navigateToRoute(route);
  },
});

export default navigateToResourceSlicesInjectable;
