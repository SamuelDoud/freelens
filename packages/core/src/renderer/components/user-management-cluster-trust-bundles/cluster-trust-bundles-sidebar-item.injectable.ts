/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { sidebarItemInjectionToken } from "@freelensapp/cluster-sidebar";
import { getInjectable } from "@ogre-tools/injectable";
import clusterTrustBundlesRouteInjectable from "../../../common/front-end-routing/routes/cluster/user-management/cluster-trust-bundles/cluster-trust-bundles-route.injectable";
import navigateToClusterTrustBundlesInjectable from "../../../common/front-end-routing/routes/cluster/user-management/cluster-trust-bundles/navigate-to-cluster-trust-bundles.injectable";
import routeIsActiveInjectable from "../../routes/route-is-active.injectable";
import userManagementSidebarItemInjectable from "../user-management/user-management-sidebar-item.injectable";

const clusterTrustBundlesSidebarItemInjectable = getInjectable({
  id: "sidebar-item-cluster-trust-bundles",

  instantiate: (di) => {
    const route = di.inject(clusterTrustBundlesRouteInjectable);

    return {
      parentId: userManagementSidebarItemInjectable.id,
      title: "Cluster Trust Bundles",
      onClick: di.inject(navigateToClusterTrustBundlesInjectable),
      isActive: di.inject(routeIsActiveInjectable, route),
      isVisible: route.isEnabled,
      orderNumber: 70,
    };
  },

  injectionToken: sidebarItemInjectionToken,
});

export default clusterTrustBundlesSidebarItemInjectable;
