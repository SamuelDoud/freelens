/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import { ResourceClaimTemplateDetails } from "../../../devices-resource-claim-templates";
import currentKubeObjectInDetailsInjectable from "../../current-kube-object-in-details.injectable";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const resourceClaimTemplateDetailItemInjectable = getInjectable({
  id: "resource-claim-template-detail-item",

  instantiate(di) {
    const kubeObject = di.inject(currentKubeObjectInDetailsInjectable);

    return {
      Component: ResourceClaimTemplateDetails,
      enabled: computed(() => isResourceClaimTemplate(kubeObject.value.get()?.object)),
      orderNumber: 10,
    };
  },

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isResourceClaimTemplate = kubeObjectMatchesToKindAndApiVersion("ResourceClaimTemplate", [
  "resource.k8s.io/v1",
]);

export default resourceClaimTemplateDetailItemInjectable;
