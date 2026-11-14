/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { ClusterRoleDetails } from "../../../user-management/cluster-roles";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const clusterRoleDetailItemInjectable = getInjectable({
  id: "cluster-role-detail-item",

  instantiate: () => ({
    Component: ClusterRoleDetails,
    isFor: isClusterRole,
    orderNumber: 10,
  }),

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export default clusterRoleDetailItemInjectable;

export const isClusterRole = kubeObjectMatchesToKindAndApiVersion("ClusterRole", ["rbac.authorization.k8s.io/v1"]);
