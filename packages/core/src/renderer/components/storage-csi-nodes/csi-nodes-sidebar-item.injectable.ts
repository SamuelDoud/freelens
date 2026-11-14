/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { sidebarItemInjectionToken } from "@freelensapp/cluster-sidebar";
import { getInjectable } from "@ogre-tools/injectable";
import csiNodesRouteInjectable from "../../../common/front-end-routing/routes/cluster/storage/csi-nodes/csi-nodes-route.injectable";
import navigateToCSINodesInjectable from "../../../common/front-end-routing/routes/cluster/storage/csi-nodes/navigate-to-csi-nodes.injectable";
import routeIsActiveInjectable from "../../routes/route-is-active.injectable";
import storageSidebarItemInjectable from "../storage/storage-sidebar-item.injectable";

const csiNodesSidebarItemInjectable = getInjectable({
  id: "sidebar-item-csi-nodes",

  instantiate: (di) => {
    const route = di.inject(csiNodesRouteInjectable);

    return {
      parentId: storageSidebarItemInjectable.id,
      title: "CSI Nodes",
      onClick: di.inject(navigateToCSINodesInjectable),
      isActive: di.inject(routeIsActiveInjectable, route),
      isVisible: route.isEnabled,
      orderNumber: 70,
    };
  },

  injectionToken: sidebarItemInjectionToken,
});

export default csiNodesSidebarItemInjectable;
