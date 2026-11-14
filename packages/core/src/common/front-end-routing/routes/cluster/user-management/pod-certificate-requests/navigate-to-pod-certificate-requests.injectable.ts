/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { navigateToRouteInjectionToken } from "../../../../navigate-to-route-injection-token";
import podCertificateRequestsRouteInjectable from "./pod-certificate-requests-route.injectable";

const navigateToPodCertificateRequestsInjectable = getInjectable({
  id: "navigate-to-pod-certificate-requests",

  instantiate: (di) => {
    const navigateToRoute = di.inject(navigateToRouteInjectionToken);
    const route = di.inject(podCertificateRequestsRouteInjectable);

    return () => navigateToRoute(route);
  },
});

export default navigateToPodCertificateRequestsInjectable;
