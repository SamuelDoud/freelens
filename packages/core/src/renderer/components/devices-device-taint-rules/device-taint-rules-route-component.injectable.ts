/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import deviceTaintRulesRouteInjectable from "../../../common/front-end-routing/routes/cluster/devices/device-taint-rules/device-taint-rules-route.injectable";
import { routeSpecificComponentInjectionToken } from "../../routes/route-specific-component-injection-token";
import { DeviceTaintRules } from "./device-taint-rules";

const deviceTaintRulesRouteComponentInjectable = getInjectable({
  id: "device-taint-rules-route-component",

  instantiate: (di) => ({
    route: di.inject(deviceTaintRulesRouteInjectable),
    Component: DeviceTaintRules,
  }),

  injectionToken: routeSpecificComponentInjectionToken,
});

export default deviceTaintRulesRouteComponentInjectable;
