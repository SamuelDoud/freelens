/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { sidebarItemInjectionToken } from "@freelensapp/cluster-sidebar";
import { getInjectable } from "@ogre-tools/injectable";
import navigateToResourceSlicesInjectable from "../../../common/front-end-routing/routes/cluster/devices/resource-slices/navigate-to-resource-slices.injectable";
import resourceSlicesRouteInjectable from "../../../common/front-end-routing/routes/cluster/devices/resource-slices/resource-slices-route.injectable";
import routeIsActiveInjectable from "../../routes/route-is-active.injectable";
import devicesSidebarItemInjectable from "../devices/devices-sidebar-item.injectable";

const resourceSlicesSidebarItemInjectable = getInjectable({
  id: "sidebar-item-resource-slices",

  instantiate: (di) => {
    const route = di.inject(resourceSlicesRouteInjectable);

    return {
      parentId: devicesSidebarItemInjectable.id,
      title: "Resource Slices",
      onClick: di.inject(navigateToResourceSlicesInjectable),
      isActive: di.inject(routeIsActiveInjectable, route),
      isVisible: route.isEnabled,
      orderNumber: 20,
    };
  },

  injectionToken: sidebarItemInjectionToken,
});

export default resourceSlicesSidebarItemInjectable;
