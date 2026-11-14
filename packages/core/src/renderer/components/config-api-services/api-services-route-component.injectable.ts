/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import apiServicesRouteInjectable from "../../../common/front-end-routing/routes/cluster/config/api-services/api-services-route.injectable";
import { routeSpecificComponentInjectionToken } from "../../routes/route-specific-component-injection-token";
import { APIServices } from "./api-services";

const apiServicesRouteComponentInjectable = getInjectable({
  id: "api-services-route-component",

  instantiate: (di) => ({
    route: di.inject(apiServicesRouteInjectable),
    Component: APIServices,
  }),

  injectionToken: routeSpecificComponentInjectionToken,
});

export default apiServicesRouteComponentInjectable;
