/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { sidebarItemInjectionToken } from "@freelensapp/cluster-sidebar";
import { getInjectable } from "@ogre-tools/injectable";
import deviceTaintRulesRouteInjectable from "../../../common/front-end-routing/routes/cluster/devices/device-taint-rules/device-taint-rules-route.injectable";
import navigateToDeviceTaintRulesInjectable from "../../../common/front-end-routing/routes/cluster/devices/device-taint-rules/navigate-to-device-taint-rules.injectable";
import routeIsActiveInjectable from "../../routes/route-is-active.injectable";
import devicesSidebarItemInjectable from "../devices/devices-sidebar-item.injectable";

const deviceTaintRulesSidebarItemInjectable = getInjectable({
  id: "sidebar-item-device-taint-rules",

  instantiate: (di) => {
    const route = di.inject(deviceTaintRulesRouteInjectable);

    return {
      parentId: devicesSidebarItemInjectable.id,
      title: "Device Taint Rules",
      onClick: di.inject(navigateToDeviceTaintRulesInjectable),
      isActive: di.inject(routeIsActiveInjectable, route),
      isVisible: route.isEnabled,
      orderNumber: 50,
    };
  },

  injectionToken: sidebarItemInjectionToken,
});

export default deviceTaintRulesSidebarItemInjectable;
