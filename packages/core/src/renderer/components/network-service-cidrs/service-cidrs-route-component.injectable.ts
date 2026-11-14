/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import serviceCidrsRouteInjectable from "../../../common/front-end-routing/routes/cluster/network/service-cidrs/service-cidrs-route.injectable";
import { routeSpecificComponentInjectionToken } from "../../routes/route-specific-component-injection-token";
import { ServiceCIDRs } from "./service-cidrs";

const serviceCidrsRouteComponentInjectable = getInjectable({
  id: "service-cidrs-route-component",

  instantiate: (di) => ({
    route: di.inject(serviceCidrsRouteInjectable),
    Component: ServiceCIDRs,
  }),

  injectionToken: routeSpecificComponentInjectionToken,
});

export default serviceCidrsRouteComponentInjectable;
