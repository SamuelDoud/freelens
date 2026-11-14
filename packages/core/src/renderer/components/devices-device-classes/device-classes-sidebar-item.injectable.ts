/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { sidebarItemInjectionToken } from "@freelensapp/cluster-sidebar";
import { getInjectable } from "@ogre-tools/injectable";
import deviceClassesRouteInjectable from "../../../common/front-end-routing/routes/cluster/devices/device-classes/device-classes-route.injectable";
import navigateToDeviceClassesInjectable from "../../../common/front-end-routing/routes/cluster/devices/device-classes/navigate-to-device-classes.injectable";
import routeIsActiveInjectable from "../../routes/route-is-active.injectable";
import devicesSidebarItemInjectable from "../devices/devices-sidebar-item.injectable";

const deviceClassesSidebarItemInjectable = getInjectable({
  id: "sidebar-item-device-classes",

  instantiate: (di) => {
    const route = di.inject(deviceClassesRouteInjectable);

    return {
      parentId: devicesSidebarItemInjectable.id,
      title: "Device Classes",
      onClick: di.inject(navigateToDeviceClassesInjectable),
      isActive: di.inject(routeIsActiveInjectable, route),
      isVisible: route.isEnabled,
      orderNumber: 10,
    };
  },

  injectionToken: sidebarItemInjectionToken,
});

export default deviceClassesSidebarItemInjectable;
