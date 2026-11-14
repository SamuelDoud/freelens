/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { ResourceClaimDetails } from "../../../devices-resource-claims";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const resourceClaimDetailItemInjectable = getInjectable({
  id: "resource-claim-detail-item",

  instantiate(di) {
    return {
      Component: ResourceClaimDetails,
      isFor: isResourceClaim,
      orderNumber: 10,
    };
  },

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isResourceClaim = kubeObjectMatchesToKindAndApiVersion("ResourceClaim", ["resource.k8s.io/v1"]);

export default resourceClaimDetailItemInjectable;
