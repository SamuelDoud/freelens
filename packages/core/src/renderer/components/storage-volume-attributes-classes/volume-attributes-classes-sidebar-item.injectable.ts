/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { sidebarItemInjectionToken } from "@freelensapp/cluster-sidebar";
import { getInjectable } from "@ogre-tools/injectable";
import navigateToVolumeAttributesClassesInjectable from "../../../common/front-end-routing/routes/cluster/storage/volume-attributes-classes/navigate-to-volume-attributes-classes.injectable";
import volumeAttributesClassesRouteInjectable from "../../../common/front-end-routing/routes/cluster/storage/volume-attributes-classes/volume-attributes-classes-route.injectable";
import routeIsActiveInjectable from "../../routes/route-is-active.injectable";
import storageSidebarItemInjectable from "../storage/storage-sidebar-item.injectable";

const volumeAttributesClassesSidebarItemInjectable = getInjectable({
  id: "sidebar-item-volume-attributes-classes",

  instantiate: (di) => {
    const route = di.inject(volumeAttributesClassesRouteInjectable);

    return {
      parentId: storageSidebarItemInjectable.id,
      title: "Volume Attributes Classes",
      onClick: di.inject(navigateToVolumeAttributesClassesInjectable),
      isActive: di.inject(routeIsActiveInjectable, route),
      isVisible: route.isEnabled,
      orderNumber: 40,
    };
  },

  injectionToken: sidebarItemInjectionToken,
});

export default volumeAttributesClassesSidebarItemInjectable;
