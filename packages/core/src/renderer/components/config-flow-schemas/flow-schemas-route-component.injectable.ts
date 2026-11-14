/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import flowSchemasRouteInjectable from "../../../common/front-end-routing/routes/cluster/config/flow-schemas/flow-schemas-route.injectable";
import { routeSpecificComponentInjectionToken } from "../../routes/route-specific-component-injection-token";
import { FlowSchemas } from "./flow-schemas";

const flowSchemasRouteComponentInjectable = getInjectable({
  id: "flow-schemas-route-component",

  instantiate: (di) => ({
    route: di.inject(flowSchemasRouteInjectable),
    Component: FlowSchemas,
  }),

  injectionToken: routeSpecificComponentInjectionToken,
});

export default flowSchemasRouteComponentInjectable;
