/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { sidebarItemInjectionToken } from "@freelensapp/cluster-sidebar";
import { getInjectable } from "@ogre-tools/injectable";
import csiStorageCapacitiesRouteInjectable from "../../../common/front-end-routing/routes/cluster/storage/csi-storage-capacities/csi-storage-capacities-route.injectable";
import navigateToCSIStorageCapacitiesInjectable from "../../../common/front-end-routing/routes/cluster/storage/csi-storage-capacities/navigate-to-csi-storage-capacities.injectable";
import routeIsActiveInjectable from "../../routes/route-is-active.injectable";
import storageSidebarItemInjectable from "../storage/storage-sidebar-item.injectable";

const csiStorageCapacitiesSidebarItemInjectable = getInjectable({
  id: "sidebar-item-csi-storage-capacities",

  instantiate: (di) => {
    const route = di.inject(csiStorageCapacitiesRouteInjectable);

    return {
      parentId: storageSidebarItemInjectable.id,
      title: "CSI Storage Capacities",
      onClick: di.inject(navigateToCSIStorageCapacitiesInjectable),
      isActive: di.inject(routeIsActiveInjectable, route),
      isVisible: route.isEnabled,
      orderNumber: 80,
    };
  },

  injectionToken: sidebarItemInjectionToken,
});

export default csiStorageCapacitiesSidebarItemInjectable;
