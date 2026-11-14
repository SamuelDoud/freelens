/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { preferenceItemInjectionToken } from "../../preference-item-injection-token";
import { RowClick } from "./row-click";

const rowClickPreferenceBlockInjectable = getInjectable({
  id: "row-click-preference-block",

  instantiate: () => ({
    kind: "block" as const,
    id: "row-click",
    parentId: "application-page",
    orderNumber: 35,
    Component: RowClick,
  }),

  injectionToken: preferenceItemInjectionToken,
});

export default rowClickPreferenceBlockInjectable;
