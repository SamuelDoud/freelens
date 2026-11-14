/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { navigateToRouteInjectionToken } from "../../../../navigate-to-route-injection-token";
import volumeAttachmentsRouteInjectable from "./volume-attachments-route.injectable";

const navigateToVolumeAttachmentsInjectable = getInjectable({
  id: "navigate-to-volume-attachments",

  instantiate: (di) => {
    const navigateToRoute = di.inject(navigateToRouteInjectionToken);
    const route = di.inject(volumeAttachmentsRouteInjectable);

    return () => navigateToRoute(route);
  },
});

export default navigateToVolumeAttachmentsInjectable;
