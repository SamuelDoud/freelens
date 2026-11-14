/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { ServiceAccountsDetails } from "../../../user-management/service-accounts";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const serviceAccountDetailItemInjectable = getInjectable({
  id: "service-account-detail-item",

  instantiate: () => ({
    Component: ServiceAccountsDetails,
    isFor: isServiceAccount,
    orderNumber: 10,
  }),

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isServiceAccount = kubeObjectMatchesToKindAndApiVersion("ServiceAccount", ["v1"]);

export default serviceAccountDetailItemInjectable;
