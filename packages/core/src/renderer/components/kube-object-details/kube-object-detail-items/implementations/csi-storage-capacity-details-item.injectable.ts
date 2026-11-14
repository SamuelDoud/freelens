/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { CSIStorageCapacityDetails } from "../../../storage-csi-storage-capacities";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const csiStorageCapacityDetailItemInjectable = getInjectable({
  id: "csi-storage-capacity-detail-item",

  instantiate(di) {
    return {
      Component: CSIStorageCapacityDetails,
      isFor: isCSIStorageCapacity,
      orderNumber: 10,
    };
  },

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isCSIStorageCapacity = kubeObjectMatchesToKindAndApiVersion("CSIStorageCapacity", ["storage.k8s.io/v1"]);

export default csiStorageCapacityDetailItemInjectable;
