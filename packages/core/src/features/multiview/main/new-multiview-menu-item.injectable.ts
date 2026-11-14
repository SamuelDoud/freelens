/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import applicationMenuItemInjectionToken from "../../application-menu/main/menu-items/application-menu-item-injection-token";
import navigateToMultiViewSettingsInjectable from "../common/navigate-to-multiview-settings.injectable";

const newMultiViewMenuItemInjectable = getInjectable({
  id: "new-multiview-application-menu-item",

  instantiate: (di) => {
    const navigateToMultiViewSettings = di.inject(navigateToMultiViewSettingsInjectable);

    return {
      kind: "clickable-menu-item" as const,
      parentId: "file",
      id: "new-multiview",
      // Right after "Add Cluster"
      orderNumber: 11,
      label: "New Multiview…",

      onClick: () => navigateToMultiViewSettings(),
    };
  },

  injectionToken: applicationMenuItemInjectionToken,
});

export default newMultiViewMenuItemInjectable;
