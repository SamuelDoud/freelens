/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { LeaseDetails } from "../../../config-leases";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const leaseDetailItemInjectable = getInjectable({
  id: "lease-detail-item",

  instantiate: () => ({
    Component: LeaseDetails,
    isFor: isLease,
    orderNumber: 10,
  }),

  injectionToken: kubeObjectDetailItemInjectionToken,
});

const isLease = kubeObjectMatchesToKindAndApiVersion("Lease", ["coordination.k8s.io/v1"]);

export default leaseDetailItemInjectable;
