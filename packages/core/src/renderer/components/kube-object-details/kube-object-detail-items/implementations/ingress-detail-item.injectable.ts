/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { IngressDetails } from "../../../network-ingresses";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const ingressDetailItemInjectable = getInjectable({
  id: "ingress-detail-item",

  instantiate: () => ({
    Component: IngressDetails,
    isFor: isIngress,
    orderNumber: 10,
  }),

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isIngress = kubeObjectMatchesToKindAndApiVersion("Ingress", [
  "networking.k8s.io/v1",
  "extensions/v1beta1",
]);

export default ingressDetailItemInjectable;
