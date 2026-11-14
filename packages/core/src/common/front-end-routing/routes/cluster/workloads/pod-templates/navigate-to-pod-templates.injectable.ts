/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { navigateToRouteInjectionToken } from "../../../../navigate-to-route-injection-token";
import podTemplatesRouteInjectable from "./pod-templates-route.injectable";

const navigateToPodTemplatesInjectable = getInjectable({
  id: "navigate-to-pod-templates",

  instantiate: (di) => {
    const navigateToRoute = di.inject(navigateToRouteInjectionToken);
    const route = di.inject(podTemplatesRouteInjectable);

    return () => navigateToRoute(route);
  },
});

export default navigateToPodTemplatesInjectable;
