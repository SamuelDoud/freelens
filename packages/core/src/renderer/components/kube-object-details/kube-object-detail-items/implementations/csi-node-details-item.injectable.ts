/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { CSINodeDetails } from "../../../storage-csi-nodes";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const csiNodeDetailItemInjectable = getInjectable({
  id: "csi-node-detail-item",

  instantiate(di) {
    return {
      Component: CSINodeDetails,
      isFor: isCSINode,
      orderNumber: 10,
    };
  },

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isCSINode = kubeObjectMatchesToKindAndApiVersion("CSINode", ["storage.k8s.io/v1"]);

export default csiNodeDetailItemInjectable;
