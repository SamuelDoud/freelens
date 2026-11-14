/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { preferenceItemInjectionToken } from "../preference-item-injection-token";

const aiPreferenceTabInjectable = getInjectable({
  id: "ai-preference-tab",

  instantiate: () => ({
    kind: "tab" as const,
    id: "ai-tab",
    pathId: "ai",
    parentId: "general-tab-group" as const,
    label: "AI",
    orderNumber: 55,
  }),

  injectionToken: preferenceItemInjectionToken,
});

export default aiPreferenceTabInjectable;
