/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { ResourceClaimTemplateDetails } from "../../../devices-resource-claim-templates";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const resourceClaimTemplateDetailItemInjectable = getInjectable({
  id: "resource-claim-template-detail-item",

  instantiate(di) {
    return {
      Component: ResourceClaimTemplateDetails,
      isFor: isResourceClaimTemplate,
      orderNumber: 10,
    };
  },

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isResourceClaimTemplate = kubeObjectMatchesToKindAndApiVersion("ResourceClaimTemplate", [
  "resource.k8s.io/v1",
]);

export default resourceClaimTemplateDetailItemInjectable;
