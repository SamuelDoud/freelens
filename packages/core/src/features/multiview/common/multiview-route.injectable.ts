/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import { frontEndRouteInjectionToken } from "../../../common/front-end-routing/front-end-route-injection-token";

import type { Route } from "../../../common/front-end-routing/front-end-route-injection-token";

export interface MultiViewPathParameters {
  multiviewId: string;
}

const multiViewRouteInjectable = getInjectable({
  id: "multiview-route",

  instantiate: (): Route<MultiViewPathParameters> => ({
    path: "/multiview/:multiviewId",
    clusterFrame: false,
    isEnabled: computed(() => true),
  }),

  injectionToken: frontEndRouteInjectionToken,
});

export default multiViewRouteInjectable;
