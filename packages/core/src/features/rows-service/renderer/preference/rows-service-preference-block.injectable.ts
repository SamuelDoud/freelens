/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { preferenceItemInjectionToken } from "../../../preferences/renderer/preference-items/preference-item-injection-token";
import { RowsServicePreference } from "./rows-service-preference";

const rowsServicePreferenceBlockInjectable = getInjectable({
  id: "rows-service-preference-block",

  instantiate: () => ({
    kind: "block" as const,
    id: "rows-service",
    parentId: "application-page",
    orderNumber: 90,
    Component: RowsServicePreference,
  }),

  injectionToken: preferenceItemInjectionToken,
});

export default rowsServicePreferenceBlockInjectable;
