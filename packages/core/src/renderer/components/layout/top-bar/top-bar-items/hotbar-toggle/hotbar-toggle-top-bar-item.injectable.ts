/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import { topBarItemOnLeftSideInjectionToken } from "../top-bar-item-injection-token";
import { HotbarToggle } from "./hotbar-toggle";

const hotbarToggleTopBarItemInjectable = getInjectable({
  id: "hotbar-toggle-top-bar-item",

  instantiate: () => ({
    id: "hotbar-toggle",
    isShown: computed(() => true),
    // At the far left, above the cluster bar it toggles.
    orderNumber: 5,
    Component: HotbarToggle,
  }),

  injectionToken: topBarItemOnLeftSideInjectionToken,
});

export default hotbarToggleTopBarItemInjectable;
