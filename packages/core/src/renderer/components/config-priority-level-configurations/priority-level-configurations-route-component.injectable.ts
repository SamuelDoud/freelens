/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import priorityLevelConfigurationsRouteInjectable from "../../../common/front-end-routing/routes/cluster/config/priority-level-configurations/priority-level-configurations-route.injectable";
import { routeSpecificComponentInjectionToken } from "../../routes/route-specific-component-injection-token";
import { PriorityLevelConfigurations } from "./priority-level-configurations";

const priorityLevelConfigurationsRouteComponentInjectable = getInjectable({
  id: "priority-level-configurations-route-component",

  instantiate: (di) => ({
    route: di.inject(priorityLevelConfigurationsRouteInjectable),
    Component: PriorityLevelConfigurations,
  }),

  injectionToken: routeSpecificComponentInjectionToken,
});

export default priorityLevelConfigurationsRouteComponentInjectable;
