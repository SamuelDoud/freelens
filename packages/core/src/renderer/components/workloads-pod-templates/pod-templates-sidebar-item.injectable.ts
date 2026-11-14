/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { sidebarItemInjectionToken } from "@freelensapp/cluster-sidebar";
import { getInjectable } from "@ogre-tools/injectable";
import navigateToPodTemplatesInjectable from "../../../common/front-end-routing/routes/cluster/workloads/pod-templates/navigate-to-pod-templates.injectable";
import podTemplatesRouteInjectable from "../../../common/front-end-routing/routes/cluster/workloads/pod-templates/pod-templates-route.injectable";
import routeIsActiveInjectable from "../../routes/route-is-active.injectable";
import workloadsSidebarItemInjectable from "../workloads/workloads-sidebar-item.injectable";

const podTemplatesSidebarItemInjectable = getInjectable({
  id: "sidebar-item-pod-templates",

  instantiate: (di) => {
    const route = di.inject(podTemplatesRouteInjectable);

    return {
      parentId: workloadsSidebarItemInjectable.id,
      title: "Pod Templates",
      onClick: di.inject(navigateToPodTemplatesInjectable),
      isActive: di.inject(routeIsActiveInjectable, route),
      isVisible: route.isEnabled,
      orderNumber: 90,
    };
  },

  injectionToken: sidebarItemInjectionToken,
});

export default podTemplatesSidebarItemInjectable;
