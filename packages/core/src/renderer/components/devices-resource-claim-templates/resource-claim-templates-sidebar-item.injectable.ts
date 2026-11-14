/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { sidebarItemInjectionToken } from "@freelensapp/cluster-sidebar";
import { getInjectable } from "@ogre-tools/injectable";
import navigateToResourceClaimTemplatesInjectable from "../../../common/front-end-routing/routes/cluster/devices/resource-claim-templates/navigate-to-resource-claim-templates.injectable";
import resourceClaimTemplatesRouteInjectable from "../../../common/front-end-routing/routes/cluster/devices/resource-claim-templates/resource-claim-templates-route.injectable";
import routeIsActiveInjectable from "../../routes/route-is-active.injectable";
import devicesSidebarItemInjectable from "../devices/devices-sidebar-item.injectable";

const resourceClaimTemplatesSidebarItemInjectable = getInjectable({
  id: "sidebar-item-resource-claim-templates",

  instantiate: (di) => {
    const route = di.inject(resourceClaimTemplatesRouteInjectable);

    return {
      parentId: devicesSidebarItemInjectable.id,
      title: "Resource Claim Templates",
      onClick: di.inject(navigateToResourceClaimTemplatesInjectable),
      isActive: di.inject(routeIsActiveInjectable, route),
      isVisible: route.isEnabled,
      orderNumber: 40,
    };
  },

  injectionToken: sidebarItemInjectionToken,
});

export default resourceClaimTemplatesSidebarItemInjectable;
