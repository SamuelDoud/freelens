/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { navigateToRouteInjectionToken } from "../../../../navigate-to-route-injection-token";
import controllerRevisionsRouteInjectable from "./controller-revisions-route.injectable";

const navigateToControllerRevisionsInjectable = getInjectable({
  id: "navigate-to-controller-revisions",

  instantiate: (di) => {
    const navigateToRoute = di.inject(navigateToRouteInjectionToken);
    const route = di.inject(controllerRevisionsRouteInjectable);

    return () => navigateToRoute(route);
  },
});

export default navigateToControllerRevisionsInjectable;
