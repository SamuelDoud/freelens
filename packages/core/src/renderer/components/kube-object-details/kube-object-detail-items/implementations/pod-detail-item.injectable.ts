/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { PodDetails } from "../../../workloads-pods";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const podDetailItemInjectable = getInjectable({
  id: "pod-detail-item",

  instantiate: () => ({
    Component: PodDetails,
    isFor: isPod,
    orderNumber: 10,
  }),

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isPod = kubeObjectMatchesToKindAndApiVersion("Pod", ["v1"]);

export default podDetailItemInjectable;
