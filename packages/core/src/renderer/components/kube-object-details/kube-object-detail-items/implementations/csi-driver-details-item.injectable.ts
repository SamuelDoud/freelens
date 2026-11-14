/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import { CSIDriverDetails } from "../../../storage-csi-drivers";
import currentKubeObjectInDetailsInjectable from "../../current-kube-object-in-details.injectable";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const csiDriverDetailItemInjectable = getInjectable({
  id: "csi-driver-detail-item",

  instantiate(di) {
    const kubeObject = di.inject(currentKubeObjectInDetailsInjectable);

    return {
      Component: CSIDriverDetails,
      enabled: computed(() => isCSIDriver(kubeObject.value.get()?.object)),
      orderNumber: 10,
    };
  },

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isCSIDriver = kubeObjectMatchesToKindAndApiVersion("CSIDriver", ["storage.k8s.io/v1"]);

export default csiDriverDetailItemInjectable;
