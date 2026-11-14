/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { ServiceDetails } from "../../../network-services";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const serviceDetailItemInjectable = getInjectable({
  id: "service-detail-item",

  instantiate: () => ({
    Component: ServiceDetails,
    isFor: isService,
    orderNumber: 10,
  }),

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isService = kubeObjectMatchesToKindAndApiVersion("Service", ["v1"]);

export default serviceDetailItemInjectable;
