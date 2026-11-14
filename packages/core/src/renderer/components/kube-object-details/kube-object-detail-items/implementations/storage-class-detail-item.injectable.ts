/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { StorageClassDetails } from "../../../storage-classes";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const storageClassDetailItemInjectable = getInjectable({
  id: "storage-class-detail-item",

  instantiate: () => ({
    Component: StorageClassDetails,
    isFor: isStorageClass,
    orderNumber: 10,
  }),

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isStorageClass = kubeObjectMatchesToKindAndApiVersion("StorageClass", ["storage.k8s.io/v1"]);

export default storageClassDetailItemInjectable;
