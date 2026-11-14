/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { IPAddressDetails } from "../../../network-ip-addresses";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const ipAddressDetailItemInjectable = getInjectable({
  id: "ip-address-detail-item",

  instantiate(di) {
    return {
      Component: IPAddressDetails,
      isFor: isIPAddress,
      orderNumber: 10,
    };
  },

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isIPAddress = kubeObjectMatchesToKindAndApiVersion("IPAddress", ["networking.k8s.io/v1"]);

export default ipAddressDetailItemInjectable;
