/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { NodeDetails } from "../../../nodes/details";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const nodeDetailItemInjectable = getInjectable({
  id: "node-detail-item",

  instantiate: () => ({
    Component: NodeDetails,
    isFor: isNode,
    orderNumber: 10,
  }),

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isNode = kubeObjectMatchesToKindAndApiVersion("Node", ["v1"]);

export default nodeDetailItemInjectable;
