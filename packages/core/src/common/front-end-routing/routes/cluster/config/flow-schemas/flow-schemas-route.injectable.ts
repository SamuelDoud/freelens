/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { shouldShowResourceInjectionToken } from "../../../../../../features/cluster/showing-kube-resources/common/allowed-resources-injection-token";
import { frontEndRouteInjectionToken } from "../../../../front-end-route-injection-token";

const flowSchemasRouteInjectable = getInjectable({
  id: "flowschemas",

  instantiate: (di) => ({
    path: "/flow-schemas",
    clusterFrame: true,
    isEnabled: di.inject(shouldShowResourceInjectionToken, {
      apiName: "flowschemas",
      group: "flowcontrol.apiserver.k8s.io",
    }),
  }),

  injectionToken: frontEndRouteInjectionToken,
});

export default flowSchemasRouteInjectable;
