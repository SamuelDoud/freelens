/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { PriorityLevelConfigurationDetails } from "../../../config-priority-level-configurations";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const priorityLevelConfigurationDetailItemInjectable = getInjectable({
  id: "priority-level-configuration-detail-item",

  instantiate(di) {
    return {
      Component: PriorityLevelConfigurationDetails,
      isFor: isPriorityLevelConfiguration,
      orderNumber: 10,
    };
  },

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isPriorityLevelConfiguration = kubeObjectMatchesToKindAndApiVersion("PriorityLevelConfiguration", [
  "flowcontrol.apiserver.k8s.io/v1",
]);

export default priorityLevelConfigurationDetailItemInjectable;
