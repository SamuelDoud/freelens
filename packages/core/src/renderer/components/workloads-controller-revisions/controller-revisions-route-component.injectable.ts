/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import controllerRevisionsRouteInjectable from "../../../common/front-end-routing/routes/cluster/workloads/controller-revisions/controller-revisions-route.injectable";
import { routeSpecificComponentInjectionToken } from "../../routes/route-specific-component-injection-token";
import { ControllerRevisions } from "./controller-revisions";

const controllerRevisionsRouteComponentInjectable = getInjectable({
  id: "controller-revisions-route-component",

  instantiate: (di) => ({
    route: di.inject(controllerRevisionsRouteInjectable),
    Component: ControllerRevisions,
  }),

  injectionToken: routeSpecificComponentInjectionToken,
});

export default controllerRevisionsRouteComponentInjectable;
