/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import podCertificateRequestsRouteInjectable from "../../../common/front-end-routing/routes/cluster/user-management/pod-certificate-requests/pod-certificate-requests-route.injectable";
import { routeSpecificComponentInjectionToken } from "../../routes/route-specific-component-injection-token";
import { PodCertificateRequests } from "./pod-certificate-requests";

const podCertificateRequestsRouteComponentInjectable = getInjectable({
  id: "pod-certificate-requests-route-component",

  instantiate: (di) => ({
    route: di.inject(podCertificateRequestsRouteInjectable),
    Component: PodCertificateRequests,
  }),

  injectionToken: routeSpecificComponentInjectionToken,
});

export default podCertificateRequestsRouteComponentInjectable;
