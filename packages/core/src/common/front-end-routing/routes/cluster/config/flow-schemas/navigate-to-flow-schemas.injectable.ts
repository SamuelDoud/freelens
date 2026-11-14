/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { navigateToRouteInjectionToken } from "../../../../navigate-to-route-injection-token";
import flowSchemasRouteInjectable from "./flow-schemas-route.injectable";

const navigateToFlowSchemasInjectable = getInjectable({
  id: "navigate-to-flow-schemas",

  instantiate: (di) => {
    const navigateToRoute = di.inject(navigateToRouteInjectionToken);
    const route = di.inject(flowSchemasRouteInjectable);

    return () => navigateToRoute(route);
  },
});

export default navigateToFlowSchemasInjectable;
