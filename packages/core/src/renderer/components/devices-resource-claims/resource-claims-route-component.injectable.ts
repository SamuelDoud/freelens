/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import resourceClaimsRouteInjectable from "../../../common/front-end-routing/routes/cluster/devices/resource-claims/resource-claims-route.injectable";
import { routeSpecificComponentInjectionToken } from "../../routes/route-specific-component-injection-token";
import { ResourceClaims } from "./resource-claims";

const resourceClaimsRouteComponentInjectable = getInjectable({
  id: "resource-claims-route-component",

  instantiate: (di) => ({
    route: di.inject(resourceClaimsRouteInjectable),
    Component: ResourceClaims,
  }),

  injectionToken: routeSpecificComponentInjectionToken,
});

export default resourceClaimsRouteComponentInjectable;
