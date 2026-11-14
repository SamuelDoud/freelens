/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { RoleDetails } from "../../../user-management/roles";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const roleDetailItemInjectable = getInjectable({
  id: "role-detail-item",

  instantiate: () => ({
    Component: RoleDetails,
    isFor: isRole,
    orderNumber: 10,
  }),

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isRole = kubeObjectMatchesToKindAndApiVersion("Role", ["rbac.authorization.k8s.io/v1"]);

export default roleDetailItemInjectable;
