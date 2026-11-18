/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { preferenceItemInjectionToken } from "../../preference-item-injection-token";
import { ExperimentalRowsPodsList } from "./experimental-rows-pods-list";

const experimentalRowsPodsListPreferenceBlockInjectable = getInjectable({
  id: "experimental-rows-pods-list-preference-block",

  instantiate: () => ({
    kind: "block" as const,
    id: "experimental-rows-pods-list",
    parentId: "application-page",
    orderNumber: 90,
    Component: ExperimentalRowsPodsList,
  }),

  injectionToken: preferenceItemInjectionToken,
});

export default experimentalRowsPodsListPreferenceBlockInjectable;
