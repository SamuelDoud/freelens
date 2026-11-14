/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { routeSpecificComponentInjectionToken } from "../../../renderer/routes/route-specific-component-injection-token";
import multiViewSettingsRouteInjectable from "../common/multiview-settings-route.injectable";
import { MultiViewSettings } from "./multiview-settings";

const multiViewSettingsRouteComponentInjectable = getInjectable({
  id: "multiview-settings-route-component",

  instantiate: (di) => ({
    route: di.inject(multiViewSettingsRouteInjectable),
    Component: MultiViewSettings,
  }),

  injectionToken: routeSpecificComponentInjectionToken,
});

export default multiViewSettingsRouteComponentInjectable;
