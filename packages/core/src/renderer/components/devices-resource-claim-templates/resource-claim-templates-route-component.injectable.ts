/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import resourceClaimTemplatesRouteInjectable from "../../../common/front-end-routing/routes/cluster/devices/resource-claim-templates/resource-claim-templates-route.injectable";
import { routeSpecificComponentInjectionToken } from "../../routes/route-specific-component-injection-token";
import { ResourceClaimTemplates } from "./resource-claim-templates";

const resourceClaimTemplatesRouteComponentInjectable = getInjectable({
  id: "resource-claim-templates-route-component",

  instantiate: (di) => ({
    route: di.inject(resourceClaimTemplatesRouteInjectable),
    Component: ResourceClaimTemplates,
  }),

  injectionToken: routeSpecificComponentInjectionToken,
});

export default resourceClaimTemplatesRouteComponentInjectable;
