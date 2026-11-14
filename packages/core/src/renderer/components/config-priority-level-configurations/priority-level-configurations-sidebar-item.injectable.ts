/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { sidebarItemInjectionToken } from "@freelensapp/cluster-sidebar";
import { getInjectable } from "@ogre-tools/injectable";
import navigateToPriorityLevelConfigurationsInjectable from "../../../common/front-end-routing/routes/cluster/config/priority-level-configurations/navigate-to-priority-level-configurations.injectable";
import priorityLevelConfigurationsRouteInjectable from "../../../common/front-end-routing/routes/cluster/config/priority-level-configurations/priority-level-configurations-route.injectable";
import routeIsActiveInjectable from "../../routes/route-is-active.injectable";
import configSidebarItemInjectable from "../config/config-sidebar-item.injectable";

const priorityLevelConfigurationsSidebarItemInjectable = getInjectable({
  id: "sidebar-item-priority-level-configurations",

  instantiate: (di) => {
    const route = di.inject(priorityLevelConfigurationsRouteInjectable);

    return {
      parentId: configSidebarItemInjectable.id,
      title: "Priority Levels",
      onClick: di.inject(navigateToPriorityLevelConfigurationsInjectable),
      isActive: di.inject(routeIsActiveInjectable, route),
      isVisible: route.isEnabled,
      orderNumber: 160,
    };
  },

  injectionToken: sidebarItemInjectionToken,
});

export default priorityLevelConfigurationsSidebarItemInjectable;
