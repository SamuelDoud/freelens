/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import deviceClassesRouteInjectable from "../../../common/front-end-routing/routes/cluster/devices/device-classes/device-classes-route.injectable";
import { routeSpecificComponentInjectionToken } from "../../routes/route-specific-component-injection-token";
import { DeviceClasses } from "./device-classes";

const deviceClassesRouteComponentInjectable = getInjectable({
  id: "device-classes-route-component",

  instantiate: (di) => ({
    route: di.inject(deviceClassesRouteInjectable),
    Component: DeviceClasses,
  }),

  injectionToken: routeSpecificComponentInjectionToken,
});

export default deviceClassesRouteComponentInjectable;
