/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { sidebarItemInjectionToken } from "@freelensapp/cluster-sidebar";
import { getInjectable } from "@ogre-tools/injectable";
import navigateToVolumeAttachmentsInjectable from "../../../common/front-end-routing/routes/cluster/storage/volume-attachments/navigate-to-volume-attachments.injectable";
import volumeAttachmentsRouteInjectable from "../../../common/front-end-routing/routes/cluster/storage/volume-attachments/volume-attachments-route.injectable";
import routeIsActiveInjectable from "../../routes/route-is-active.injectable";
import storageSidebarItemInjectable from "../storage/storage-sidebar-item.injectable";

const volumeAttachmentsSidebarItemInjectable = getInjectable({
  id: "sidebar-item-volume-attachments",

  instantiate: (di) => {
    const route = di.inject(volumeAttachmentsRouteInjectable);

    return {
      parentId: storageSidebarItemInjectable.id,
      title: "Volume Attachments",
      onClick: di.inject(navigateToVolumeAttachmentsInjectable),
      isActive: di.inject(routeIsActiveInjectable, route),
      isVisible: route.isEnabled,
      orderNumber: 50,
    };
  },

  injectionToken: sidebarItemInjectionToken,
});

export default volumeAttachmentsSidebarItemInjectable;
