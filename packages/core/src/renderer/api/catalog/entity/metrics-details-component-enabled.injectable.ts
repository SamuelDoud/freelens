/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import enabledMetricsInjectable from "./metrics-enabled.injectable";

import type { KubeObject } from "@freelensapp/kube-object";

import type { ClusterMetricsResourceType } from "../../../../common/cluster-types";

const metricsDetailsComponentEnabledInjectable = getInjectable({
  id: "metrics-details-component-enabled",
  instantiate: (di, kind) => {
    const metricsEnabled = di.inject(enabledMetricsInjectable, kind);
    // Whether an object of this kind shows its metrics.
    return (object: KubeObject) => metricsEnabled.get() && object.kind === kind;
  },
  lifecycle: lifecycleEnum.keyedSingleton({
    getInstanceKey: (di, kind: ClusterMetricsResourceType) => kind,
  }),
});

export default metricsDetailsComponentEnabledInjectable;
