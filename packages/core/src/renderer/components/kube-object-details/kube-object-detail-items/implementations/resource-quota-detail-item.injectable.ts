/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { ResourceQuotaDetails } from "../../../config-resource-quotas";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const resourceQuotaDetailItemInjectable = getInjectable({
  id: "resource-quota-detail-item",

  instantiate: () => ({
    Component: ResourceQuotaDetails,
    isFor: isResourceQuota,
    orderNumber: 10,
  }),

  injectionToken: kubeObjectDetailItemInjectionToken,
});

const isResourceQuota = kubeObjectMatchesToKindAndApiVersion("ResourceQuota", ["v1"]);

export default resourceQuotaDetailItemInjectable;
