/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { EndpointsDetails } from "../../../network-endpoints";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const endpointsDetailItemInjectable = getInjectable({
  id: "endpoints-detail-item",

  instantiate: () => ({
    Component: EndpointsDetails,
    isFor: isEndpoint,
    orderNumber: 10,
  }),

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isEndpoint = kubeObjectMatchesToKindAndApiVersion("Endpoints", ["v1"]);

export default endpointsDetailItemInjectable;
