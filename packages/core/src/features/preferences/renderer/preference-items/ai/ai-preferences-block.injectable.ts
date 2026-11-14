/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { preferenceItemInjectionToken } from "../preference-item-injection-token";
import { AiPreferences } from "./ai-preferences";

const aiPreferencesBlockInjectable = getInjectable({
  id: "ai-preferences-block",

  instantiate: () => ({
    kind: "block" as const,
    id: "ai-preferences",
    parentId: "ai-page",
    orderNumber: 10,
    Component: AiPreferences,
  }),

  injectionToken: preferenceItemInjectionToken,
});

export default aiPreferencesBlockInjectable;
