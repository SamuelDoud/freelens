/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { navigateToRouteInjectionToken } from "../../../../navigate-to-route-injection-token";
import volumeAttributesClassesRouteInjectable from "./volume-attributes-classes-route.injectable";

const navigateToVolumeAttributesClassesInjectable = getInjectable({
  id: "navigate-to-volume-attributes-classes",

  instantiate: (di) => {
    const navigateToRoute = di.inject(navigateToRouteInjectionToken);
    const route = di.inject(volumeAttributesClassesRouteInjectable);

    return () => navigateToRoute(route);
  },
});

export default navigateToVolumeAttributesClassesInjectable;
