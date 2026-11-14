/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { DeploymentDetails } from "../../../workloads-deployments";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const deploymentDetailItemInjectable = getInjectable({
  id: "deployment-detail-item",

  instantiate: () => ({
    Component: DeploymentDetails,
    isFor: isDeployment,
    orderNumber: 10,
  }),

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isDeployment = kubeObjectMatchesToKindAndApiVersion("Deployment", ["apps/v1"]);

export default deploymentDetailItemInjectable;
