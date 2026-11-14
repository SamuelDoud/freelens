/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { ReplicationControllerDetails } from "../../../workloads-replication-controllers";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const replicationControllerDetailItemInjectable = getInjectable({
  id: "replication-controller-detail-item",

  instantiate(di) {
    return {
      Component: ReplicationControllerDetails,
      isFor: isReplicationController,
      orderNumber: 10,
    };
  },

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isReplicationController = kubeObjectMatchesToKindAndApiVersion("ReplicationController", ["v1"]);

export default replicationControllerDetailItemInjectable;
