/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { routeSpecificComponentInjectionToken } from "../../../renderer/routes/route-specific-component-injection-token";
import multiViewRouteInjectable from "../common/multiview-route.injectable";
import { MultiViewPage } from "./multiview-page";

const multiViewPageRouteComponentInjectable = getInjectable({
  id: "multiview-page-route-component",

  instantiate: (di) => ({
    route: di.inject(multiViewRouteInjectable),
    Component: MultiViewPage,
  }),

  injectionToken: routeSpecificComponentInjectionToken,
});

export default multiViewPageRouteComponentInjectable;
