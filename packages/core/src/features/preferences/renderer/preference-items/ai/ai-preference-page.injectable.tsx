/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { PreferencePageComponent } from "../../preference-page-component";
import { preferenceItemInjectionToken } from "../preference-item-injection-token";

import type { PreferenceItemComponent, PreferencePage } from "../preference-item-injection-token";

const AiPage: PreferenceItemComponent<PreferencePage> = ({ children, item }) => (
  <PreferencePageComponent title="AI" id={item.id}>
    {children}
  </PreferencePageComponent>
);

const aiPreferencePageInjectable = getInjectable({
  id: "ai-preference-page",

  instantiate: () => ({
    kind: "page" as const,
    id: "ai-page",
    parentId: "ai-tab",
    Component: AiPage,
  }),

  injectionToken: preferenceItemInjectionToken,
});

export default aiPreferencePageInjectable;
