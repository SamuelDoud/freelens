/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { PriorityClassesDetails } from "../../../config-priority-classes";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const priorityClassDetailItemInjectable = getInjectable({
  id: "priority-class-detail-item",

  instantiate: () => ({
    Component: PriorityClassesDetails,
    isFor: isPriorityClass,
    orderNumber: 10,
  }),

  injectionToken: kubeObjectDetailItemInjectionToken,
});

const isPriorityClass = kubeObjectMatchesToKindAndApiVersion("PriorityClass", ["scheduling.k8s.io/v1"]);

export default priorityClassDetailItemInjectable;
