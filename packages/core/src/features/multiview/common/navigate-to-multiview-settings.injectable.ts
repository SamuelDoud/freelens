/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { navigateToRouteInjectionToken } from "../../../common/front-end-routing/navigate-to-route-injection-token";
import { newMultiViewId } from "./multiview";
import multiViewSettingsRouteInjectable from "./multiview-settings-route.injectable";

export type NavigateToMultiViewSettings = (multiviewId?: string) => void;

const navigateToMultiViewSettingsInjectable = getInjectable({
  id: "navigate-to-multiview-settings",

  instantiate: (di): NavigateToMultiViewSettings => {
    const navigateToRoute = di.inject(navigateToRouteInjectionToken);
    const route = di.inject(multiViewSettingsRouteInjectable);

    return (multiviewId = newMultiViewId) => navigateToRoute(route, { parameters: { multiviewId } });
  },
});

export default navigateToMultiViewSettingsInjectable;
