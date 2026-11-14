/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { sidebarItemInjectionToken } from "@freelensapp/cluster-sidebar";
import { getInjectable } from "@ogre-tools/injectable";
import navigateToResourceClaimsInjectable from "../../../common/front-end-routing/routes/cluster/devices/resource-claims/navigate-to-resource-claims.injectable";
import resourceClaimsRouteInjectable from "../../../common/front-end-routing/routes/cluster/devices/resource-claims/resource-claims-route.injectable";
import routeIsActiveInjectable from "../../routes/route-is-active.injectable";
import devicesSidebarItemInjectable from "../devices/devices-sidebar-item.injectable";

const resourceClaimsSidebarItemInjectable = getInjectable({
  id: "sidebar-item-resource-claims",

  instantiate: (di) => {
    const route = di.inject(resourceClaimsRouteInjectable);

    return {
      parentId: devicesSidebarItemInjectable.id,
      title: "Resource Claims",
      onClick: di.inject(navigateToResourceClaimsInjectable),
      isActive: di.inject(routeIsActiveInjectable, route),
      isVisible: route.isEnabled,
      orderNumber: 30,
    };
  },

  injectionToken: sidebarItemInjectionToken,
});

export default resourceClaimsSidebarItemInjectable;
