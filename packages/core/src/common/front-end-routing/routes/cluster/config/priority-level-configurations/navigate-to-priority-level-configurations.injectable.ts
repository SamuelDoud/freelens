/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { navigateToRouteInjectionToken } from "../../../../navigate-to-route-injection-token";
import priorityLevelConfigurationsRouteInjectable from "./priority-level-configurations-route.injectable";

const navigateToPriorityLevelConfigurationsInjectable = getInjectable({
  id: "navigate-to-priority-level-configurations",

  instantiate: (di) => {
    const navigateToRoute = di.inject(navigateToRouteInjectionToken);
    const route = di.inject(priorityLevelConfigurationsRouteInjectable);

    return () => navigateToRoute(route);
  },
});

export default navigateToPriorityLevelConfigurationsInjectable;
