/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { sidebarItemInjectionToken } from "@freelensapp/cluster-sidebar";
import { getInjectable } from "@ogre-tools/injectable";
import csiDriversRouteInjectable from "../../../common/front-end-routing/routes/cluster/storage/csi-drivers/csi-drivers-route.injectable";
import navigateToCSIDriversInjectable from "../../../common/front-end-routing/routes/cluster/storage/csi-drivers/navigate-to-csi-drivers.injectable";
import routeIsActiveInjectable from "../../routes/route-is-active.injectable";
import storageSidebarItemInjectable from "../storage/storage-sidebar-item.injectable";

const csiDriversSidebarItemInjectable = getInjectable({
  id: "sidebar-item-csi-drivers",

  instantiate: (di) => {
    const route = di.inject(csiDriversRouteInjectable);

    return {
      parentId: storageSidebarItemInjectable.id,
      title: "CSI Drivers",
      onClick: di.inject(navigateToCSIDriversInjectable),
      isActive: di.inject(routeIsActiveInjectable, route),
      isVisible: route.isEnabled,
      orderNumber: 60,
    };
  },

  injectionToken: sidebarItemInjectionToken,
});

export default csiDriversSidebarItemInjectable;
