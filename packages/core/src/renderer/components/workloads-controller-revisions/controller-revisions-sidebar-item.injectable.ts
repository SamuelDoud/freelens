/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { sidebarItemInjectionToken } from "@freelensapp/cluster-sidebar";
import { getInjectable } from "@ogre-tools/injectable";
import controllerRevisionsRouteInjectable from "../../../common/front-end-routing/routes/cluster/workloads/controller-revisions/controller-revisions-route.injectable";
import navigateToControllerRevisionsInjectable from "../../../common/front-end-routing/routes/cluster/workloads/controller-revisions/navigate-to-controller-revisions.injectable";
import routeIsActiveInjectable from "../../routes/route-is-active.injectable";
import workloadsSidebarItemInjectable from "../workloads/workloads-sidebar-item.injectable";

const controllerRevisionsSidebarItemInjectable = getInjectable({
  id: "sidebar-item-controller-revisions",

  instantiate: (di) => {
    const route = di.inject(controllerRevisionsRouteInjectable);

    return {
      parentId: workloadsSidebarItemInjectable.id,
      title: "Controller Revisions",
      onClick: di.inject(navigateToControllerRevisionsInjectable),
      isActive: di.inject(routeIsActiveInjectable, route),
      isVisible: route.isEnabled,
      orderNumber: 100,
    };
  },

  injectionToken: sidebarItemInjectionToken,
});

export default controllerRevisionsSidebarItemInjectable;
