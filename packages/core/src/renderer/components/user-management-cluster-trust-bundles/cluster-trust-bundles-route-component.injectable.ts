/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import clusterTrustBundlesRouteInjectable from "../../../common/front-end-routing/routes/cluster/user-management/cluster-trust-bundles/cluster-trust-bundles-route.injectable";
import { routeSpecificComponentInjectionToken } from "../../routes/route-specific-component-injection-token";
import { ClusterTrustBundles } from "./cluster-trust-bundles";

const clusterTrustBundlesRouteComponentInjectable = getInjectable({
  id: "cluster-trust-bundles-route-component",

  instantiate: (di) => ({
    route: di.inject(clusterTrustBundlesRouteInjectable),
    Component: ClusterTrustBundles,
  }),

  injectionToken: routeSpecificComponentInjectionToken,
});

export default clusterTrustBundlesRouteComponentInjectable;
