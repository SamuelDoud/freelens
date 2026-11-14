/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import { CSIStorageCapacityDetails } from "../../../storage-csi-storage-capacities";
import currentKubeObjectInDetailsInjectable from "../../current-kube-object-in-details.injectable";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const csiStorageCapacityDetailItemInjectable = getInjectable({
  id: "csi-storage-capacity-detail-item",

  instantiate(di) {
    const kubeObject = di.inject(currentKubeObjectInDetailsInjectable);

    return {
      Component: CSIStorageCapacityDetails,
      enabled: computed(() => isCSIStorageCapacity(kubeObject.value.get()?.object)),
      orderNumber: 10,
    };
  },

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isCSIStorageCapacity = kubeObjectMatchesToKindAndApiVersion("CSIStorageCapacity", ["storage.k8s.io/v1"]);

export default csiStorageCapacityDetailItemInjectable;
