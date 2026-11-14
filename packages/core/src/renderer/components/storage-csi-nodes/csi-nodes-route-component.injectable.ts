/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import csiNodesRouteInjectable from "../../../common/front-end-routing/routes/cluster/storage/csi-nodes/csi-nodes-route.injectable";
import { routeSpecificComponentInjectionToken } from "../../routes/route-specific-component-injection-token";
import { CSINodes } from "./csi-nodes";

const csiNodesRouteComponentInjectable = getInjectable({
  id: "csi-nodes-route-component",

  instantiate: (di) => ({
    route: di.inject(csiNodesRouteInjectable),
    Component: CSINodes,
  }),

  injectionToken: routeSpecificComponentInjectionToken,
});

export default csiNodesRouteComponentInjectable;
