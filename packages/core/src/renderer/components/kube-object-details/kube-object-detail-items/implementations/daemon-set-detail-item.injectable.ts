/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { DaemonSetDetails } from "../../../workloads-daemonsets";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const daemonSetDetailItemInjectable = getInjectable({
  id: "daemon-set-detail-item",

  instantiate: () => ({
    Component: DaemonSetDetails,
    isFor: isDaemonSet,
    orderNumber: 10,
  }),

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export default daemonSetDetailItemInjectable;

export const isDaemonSet = kubeObjectMatchesToKindAndApiVersion("DaemonSet", ["apps/v1"]);
