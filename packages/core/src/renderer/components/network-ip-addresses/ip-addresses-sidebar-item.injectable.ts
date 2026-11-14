/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { sidebarItemInjectionToken } from "@freelensapp/cluster-sidebar";
import { getInjectable } from "@ogre-tools/injectable";
import ipAddressesRouteInjectable from "../../../common/front-end-routing/routes/cluster/network/ip-addresses/ip-addresses-route.injectable";
import navigateToIPAddressesInjectable from "../../../common/front-end-routing/routes/cluster/network/ip-addresses/navigate-to-ip-addresses.injectable";
import routeIsActiveInjectable from "../../routes/route-is-active.injectable";
import networkSidebarItemInjectable from "../network/network-sidebar-item.injectable";

const ipAddressesSidebarItemInjectable = getInjectable({
  id: "sidebar-item-ip-addresses",

  instantiate: (di) => {
    const route = di.inject(ipAddressesRouteInjectable);

    return {
      parentId: networkSidebarItemInjectable.id,
      title: "IP Addresses",
      onClick: di.inject(navigateToIPAddressesInjectable),
      isActive: di.inject(routeIsActiveInjectable, route),
      isVisible: route.isEnabled,
      orderNumber: 70,
    };
  },

  injectionToken: sidebarItemInjectionToken,
});

export default ipAddressesSidebarItemInjectable;
