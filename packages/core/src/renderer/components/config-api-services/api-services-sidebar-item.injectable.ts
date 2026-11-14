/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { sidebarItemInjectionToken } from "@freelensapp/cluster-sidebar";
import { getInjectable } from "@ogre-tools/injectable";
import apiServicesRouteInjectable from "../../../common/front-end-routing/routes/cluster/config/api-services/api-services-route.injectable";
import navigateToAPIServicesInjectable from "../../../common/front-end-routing/routes/cluster/config/api-services/navigate-to-api-services.injectable";
import routeIsActiveInjectable from "../../routes/route-is-active.injectable";
import configSidebarItemInjectable from "../config/config-sidebar-item.injectable";

const apiServicesSidebarItemInjectable = getInjectable({
  id: "sidebar-item-api-services",

  instantiate: (di) => {
    const route = di.inject(apiServicesRouteInjectable);

    return {
      parentId: configSidebarItemInjectable.id,
      title: "API Services",
      onClick: di.inject(navigateToAPIServicesInjectable),
      isActive: di.inject(routeIsActiveInjectable, route),
      isVisible: route.isEnabled,
      orderNumber: 170,
    };
  },

  injectionToken: sidebarItemInjectionToken,
});

export default apiServicesSidebarItemInjectable;
