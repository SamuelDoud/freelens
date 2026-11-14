/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { ServiceCIDRDetails } from "../../../network-service-cidrs";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const serviceCidrDetailItemInjectable = getInjectable({
  id: "service-cidr-detail-item",

  instantiate(di) {
    return {
      Component: ServiceCIDRDetails,
      isFor: isServiceCIDR,
      orderNumber: 10,
    };
  },

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isServiceCIDR = kubeObjectMatchesToKindAndApiVersion("ServiceCIDR", ["networking.k8s.io/v1"]);

export default serviceCidrDetailItemInjectable;
