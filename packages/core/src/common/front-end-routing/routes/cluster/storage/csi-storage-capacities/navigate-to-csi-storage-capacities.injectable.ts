/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { navigateToRouteInjectionToken } from "../../../../navigate-to-route-injection-token";
import csiStorageCapacitiesRouteInjectable from "./csi-storage-capacities-route.injectable";

const navigateToCSIStorageCapacitiesInjectable = getInjectable({
  id: "navigate-to-csi-storage-capacities",

  instantiate: (di) => {
    const navigateToRoute = di.inject(navigateToRouteInjectionToken);
    const route = di.inject(csiStorageCapacitiesRouteInjectable);

    return () => navigateToRoute(route);
  },
});

export default navigateToCSIStorageCapacitiesInjectable;
