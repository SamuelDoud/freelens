/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { APIServiceDetails } from "../../../config-api-services";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const apiServiceDetailItemInjectable = getInjectable({
  id: "api-service-detail-item",

  instantiate(di) {
    return {
      Component: APIServiceDetails,
      isFor: isAPIService,
      orderNumber: 10,
    };
  },

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isAPIService = kubeObjectMatchesToKindAndApiVersion("APIService", ["apiregistration.k8s.io/v1"]);

export default apiServiceDetailItemInjectable;
