/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import { ResourceClaimDetails } from "../../../devices-resource-claims";
import currentKubeObjectInDetailsInjectable from "../../current-kube-object-in-details.injectable";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const resourceClaimDetailItemInjectable = getInjectable({
  id: "resource-claim-detail-item",

  instantiate(di) {
    const kubeObject = di.inject(currentKubeObjectInDetailsInjectable);

    return {
      Component: ResourceClaimDetails,
      enabled: computed(() => isResourceClaim(kubeObject.value.get()?.object)),
      orderNumber: 10,
    };
  },

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isResourceClaim = kubeObjectMatchesToKindAndApiVersion("ResourceClaim", ["resource.k8s.io/v1"]);

export default resourceClaimDetailItemInjectable;
