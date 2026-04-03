/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { preferenceItemInjectionToken } from "../../preference-item-injection-token";
import { ListPageSize } from "./list-page-size";

const listPageSizePreferenceBlockInjectable = getInjectable({
  id: "list-page-size-preference-item",

  instantiate: () => ({
    kind: "block" as const,
    id: "list-page-size",
    parentId: "application-page",
    orderNumber: 40,
    Component: ListPageSize,
  }),

  injectionToken: preferenceItemInjectionToken,
});

export default listPageSizePreferenceBlockInjectable;
