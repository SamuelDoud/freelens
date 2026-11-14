/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { PodTemplateDetails } from "../../../workloads-pod-templates";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const podTemplateDetailItemInjectable = getInjectable({
  id: "pod-template-detail-item",

  instantiate(di) {
    return {
      Component: PodTemplateDetails,
      isFor: isPodTemplate,
      orderNumber: 10,
    };
  },

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isPodTemplate = kubeObjectMatchesToKindAndApiVersion("PodTemplate", ["v1"]);

export default podTemplateDetailItemInjectable;
