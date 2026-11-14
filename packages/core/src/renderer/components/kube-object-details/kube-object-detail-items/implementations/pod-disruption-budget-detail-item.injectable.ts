/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { PodDisruptionBudget } from "@freelensapp/kube-object";
import { getInjectable } from "@ogre-tools/injectable";
import { PodDisruptionBudgetDetails } from "../../../config-pod-disruption-budgets";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";

const podDisruptionBudgetDetailItemInjectable = getInjectable({
  id: "pod-disruption-budget-detail-item",

  instantiate: () => ({
    Component: PodDisruptionBudgetDetails,
    isFor: (object) => object instanceof PodDisruptionBudget,
    orderNumber: 10,
  }),

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export default podDisruptionBudgetDetailItemInjectable;
