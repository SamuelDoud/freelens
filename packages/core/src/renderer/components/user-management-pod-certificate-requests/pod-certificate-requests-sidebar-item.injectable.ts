/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { sidebarItemInjectionToken } from "@freelensapp/cluster-sidebar";
import { getInjectable } from "@ogre-tools/injectable";
import navigateToPodCertificateRequestsInjectable from "../../../common/front-end-routing/routes/cluster/user-management/pod-certificate-requests/navigate-to-pod-certificate-requests.injectable";
import podCertificateRequestsRouteInjectable from "../../../common/front-end-routing/routes/cluster/user-management/pod-certificate-requests/pod-certificate-requests-route.injectable";
import routeIsActiveInjectable from "../../routes/route-is-active.injectable";
import userManagementSidebarItemInjectable from "../user-management/user-management-sidebar-item.injectable";

const podCertificateRequestsSidebarItemInjectable = getInjectable({
  id: "sidebar-item-pod-certificate-requests",

  instantiate: (di) => {
    const route = di.inject(podCertificateRequestsRouteInjectable);

    return {
      parentId: userManagementSidebarItemInjectable.id,
      title: "Pod Certificate Requests",
      onClick: di.inject(navigateToPodCertificateRequestsInjectable),
      isActive: di.inject(routeIsActiveInjectable, route),
      isVisible: route.isEnabled,
      orderNumber: 80,
    };
  },

  injectionToken: sidebarItemInjectionToken,
});

export default podCertificateRequestsSidebarItemInjectable;
