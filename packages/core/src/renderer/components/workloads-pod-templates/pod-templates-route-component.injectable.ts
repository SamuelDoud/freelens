/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import podTemplatesRouteInjectable from "../../../common/front-end-routing/routes/cluster/workloads/pod-templates/pod-templates-route.injectable";
import { routeSpecificComponentInjectionToken } from "../../routes/route-specific-component-injection-token";
import { PodTemplates } from "./pod-templates";

const podTemplatesRouteComponentInjectable = getInjectable({
  id: "pod-templates-route-component",

  instantiate: (di) => ({
    route: di.inject(podTemplatesRouteInjectable),
    Component: PodTemplates,
  }),

  injectionToken: routeSpecificComponentInjectionToken,
});

export default podTemplatesRouteComponentInjectable;
