/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import csiDriversRouteInjectable from "../../../common/front-end-routing/routes/cluster/storage/csi-drivers/csi-drivers-route.injectable";
import { routeSpecificComponentInjectionToken } from "../../routes/route-specific-component-injection-token";
import { CSIDrivers } from "./csi-drivers";

const csiDriversRouteComponentInjectable = getInjectable({
  id: "csi-drivers-route-component",

  instantiate: (di) => ({
    route: di.inject(csiDriversRouteInjectable),
    Component: CSIDrivers,
  }),

  injectionToken: routeSpecificComponentInjectionToken,
});

export default csiDriversRouteComponentInjectable;
