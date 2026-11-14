/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import resourceSlicesRouteInjectable from "../../../common/front-end-routing/routes/cluster/devices/resource-slices/resource-slices-route.injectable";
import { routeSpecificComponentInjectionToken } from "../../routes/route-specific-component-injection-token";
import { ResourceSlices } from "./resource-slices";

const resourceSlicesRouteComponentInjectable = getInjectable({
  id: "resource-slices-route-component",

  instantiate: (di) => ({
    route: di.inject(resourceSlicesRouteInjectable),
    Component: ResourceSlices,
  }),

  injectionToken: routeSpecificComponentInjectionToken,
});

export default resourceSlicesRouteComponentInjectable;
