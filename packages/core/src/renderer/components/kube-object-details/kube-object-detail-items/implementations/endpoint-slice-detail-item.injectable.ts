/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { EndpointSliceDetails } from "../../../network-endpoint-slices";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const endpointSliceDetailItemInjectable = getInjectable({
  id: "endpoint-slice-detail-item",

  instantiate: () => ({
    Component: EndpointSliceDetails,
    isFor: isEndpoint,
    orderNumber: 10,
  }),

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isEndpoint = kubeObjectMatchesToKindAndApiVersion("EndpointSlice", ["discovery.k8s.io/v1"]);

export default endpointSliceDetailItemInjectable;
