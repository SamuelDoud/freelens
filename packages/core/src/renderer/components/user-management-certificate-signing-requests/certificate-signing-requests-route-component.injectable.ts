/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import certificateSigningRequestsRouteInjectable from "../../../common/front-end-routing/routes/cluster/user-management/certificate-signing-requests/certificate-signing-requests-route.injectable";
import { routeSpecificComponentInjectionToken } from "../../routes/route-specific-component-injection-token";
import { CertificateSigningRequests } from "./certificate-signing-requests";

const certificateSigningRequestsRouteComponentInjectable = getInjectable({
  id: "certificate-signing-requests-route-component",

  instantiate: (di) => ({
    route: di.inject(certificateSigningRequestsRouteInjectable),
    Component: CertificateSigningRequests,
  }),

  injectionToken: routeSpecificComponentInjectionToken,
});

export default certificateSigningRequestsRouteComponentInjectable;
