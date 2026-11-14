/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import csiStorageCapacitiesRouteInjectable from "../../../common/front-end-routing/routes/cluster/storage/csi-storage-capacities/csi-storage-capacities-route.injectable";
import { routeSpecificComponentInjectionToken } from "../../routes/route-specific-component-injection-token";
import { CSIStorageCapacities } from "./csi-storage-capacities";

const csiStorageCapacitiesRouteComponentInjectable = getInjectable({
  id: "csi-storage-capacities-route-component",

  instantiate: (di) => ({
    route: di.inject(csiStorageCapacitiesRouteInjectable),
    Component: CSIStorageCapacities,
  }),

  injectionToken: routeSpecificComponentInjectionToken,
});

export default csiStorageCapacitiesRouteComponentInjectable;
