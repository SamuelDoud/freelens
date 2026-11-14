/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { sidebarItemInjectionToken } from "@freelensapp/cluster-sidebar";
import { getInjectable } from "@ogre-tools/injectable";
import certificateSigningRequestsRouteInjectable from "../../../common/front-end-routing/routes/cluster/user-management/certificate-signing-requests/certificate-signing-requests-route.injectable";
import navigateToCertificateSigningRequestsInjectable from "../../../common/front-end-routing/routes/cluster/user-management/certificate-signing-requests/navigate-to-certificate-signing-requests.injectable";
import routeIsActiveInjectable from "../../routes/route-is-active.injectable";
import userManagementSidebarItemInjectable from "../user-management/user-management-sidebar-item.injectable";

const certificateSigningRequestsSidebarItemInjectable = getInjectable({
  id: "sidebar-item-certificate-signing-requests",

  instantiate: (di) => {
    const route = di.inject(certificateSigningRequestsRouteInjectable);

    return {
      parentId: userManagementSidebarItemInjectable.id,
      title: "Certificate Signing Requests",
      onClick: di.inject(navigateToCertificateSigningRequestsInjectable),
      isActive: di.inject(routeIsActiveInjectable, route),
      isVisible: route.isEnabled,
      orderNumber: 60,
    };
  },

  injectionToken: sidebarItemInjectionToken,
});

export default certificateSigningRequestsSidebarItemInjectable;
