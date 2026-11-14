/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { sidebarItemInjectionToken } from "@freelensapp/cluster-sidebar";
import { getInjectable } from "@ogre-tools/injectable";
import navigateToServiceCIDRsInjectable from "../../../common/front-end-routing/routes/cluster/network/service-cidrs/navigate-to-service-cidrs.injectable";
import serviceCidrsRouteInjectable from "../../../common/front-end-routing/routes/cluster/network/service-cidrs/service-cidrs-route.injectable";
import routeIsActiveInjectable from "../../routes/route-is-active.injectable";
import networkSidebarItemInjectable from "../network/network-sidebar-item.injectable";

const serviceCidrsSidebarItemInjectable = getInjectable({
  id: "sidebar-item-service-cidrs",

  instantiate: (di) => {
    const route = di.inject(serviceCidrsRouteInjectable);

    return {
      parentId: networkSidebarItemInjectable.id,
      title: "Service CIDRs",
      onClick: di.inject(navigateToServiceCIDRsInjectable),
      isActive: di.inject(routeIsActiveInjectable, route),
      isVisible: route.isEnabled,
      orderNumber: 60,
    };
  },

  injectionToken: sidebarItemInjectionToken,
});

export default serviceCidrsSidebarItemInjectable;
