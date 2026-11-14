/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { PersistentVolumeDetails } from "../../../storage-volumes";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const persistentVolumeDetailItemInjectable = getInjectable({
  id: "persistent-volume-detail-item",

  instantiate: () => ({
    Component: PersistentVolumeDetails,
    isFor: isPersistentVolume,
    orderNumber: 10,
  }),

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isPersistentVolume = kubeObjectMatchesToKindAndApiVersion("PersistentVolume", ["v1"]);

export default persistentVolumeDetailItemInjectable;
