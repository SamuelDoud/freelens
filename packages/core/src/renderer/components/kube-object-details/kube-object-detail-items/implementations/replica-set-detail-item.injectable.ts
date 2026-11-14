/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { ReplicaSetDetails } from "../../../workloads-replicasets";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const replicaSetDetailItemInjectable = getInjectable({
  id: "replica-set-detail-item",

  instantiate: () => ({
    Component: ReplicaSetDetails,
    isFor: isReplicaSet,
    orderNumber: 10,
  }),

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isReplicaSet = kubeObjectMatchesToKindAndApiVersion("ReplicaSet", ["apps/v1"]);

export default replicaSetDetailItemInjectable;
