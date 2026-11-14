/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { preferenceItemInjectionToken } from "../../preference-item-injection-token";
import { Appearance } from "./appearance";

const appearancePreferenceBlockInjectable = getInjectable({
  id: "appearance-preference-block",

  instantiate: () => ({
    kind: "block" as const,
    id: "appearance",
    parentId: "application-page",
    // Right after the theme
    orderNumber: 11,
    Component: Appearance,
  }),

  injectionToken: preferenceItemInjectionToken,
});

export default appearancePreferenceBlockInjectable;
