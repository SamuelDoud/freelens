/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { HorizontalPodAutoscalerDetails } from "../../../config-horizontal-pod-autoscalers";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const horizontalPodAutoscalerDetailItemInjectable = getInjectable({
  id: "horizontal-pod-autoscaler-detail-item",

  instantiate: () => ({
    Component: HorizontalPodAutoscalerDetails,
    isFor: isHorizontalPodAutoscaler,
    orderNumber: 10,
  }),

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isHorizontalPodAutoscaler = kubeObjectMatchesToKindAndApiVersion("HorizontalPodAutoscaler", [
  "autoscaling/v2",
  "autoscaling/v2beta2",
  "autoscaling/v2beta1",
  "autoscaling/v1",
]);

export default horizontalPodAutoscalerDetailItemInjectable;
