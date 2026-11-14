/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { sidebarItemInjectionToken } from "@freelensapp/cluster-sidebar";
import { getInjectable } from "@ogre-tools/injectable";
import flowSchemasRouteInjectable from "../../../common/front-end-routing/routes/cluster/config/flow-schemas/flow-schemas-route.injectable";
import navigateToFlowSchemasInjectable from "../../../common/front-end-routing/routes/cluster/config/flow-schemas/navigate-to-flow-schemas.injectable";
import routeIsActiveInjectable from "../../routes/route-is-active.injectable";
import configSidebarItemInjectable from "../config/config-sidebar-item.injectable";

const flowSchemasSidebarItemInjectable = getInjectable({
  id: "sidebar-item-flow-schemas",

  instantiate: (di) => {
    const route = di.inject(flowSchemasRouteInjectable);

    return {
      parentId: configSidebarItemInjectable.id,
      title: "Flow Schemas",
      onClick: di.inject(navigateToFlowSchemasInjectable),
      isActive: di.inject(routeIsActiveInjectable, route),
      isVisible: route.isEnabled,
      orderNumber: 150,
    };
  },

  injectionToken: sidebarItemInjectionToken,
});

export default flowSchemasSidebarItemInjectable;
