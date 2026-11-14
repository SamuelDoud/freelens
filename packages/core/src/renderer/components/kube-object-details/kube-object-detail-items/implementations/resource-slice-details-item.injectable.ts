/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { ResourceSliceDetails } from "../../../devices-resource-slices";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const resourceSliceDetailItemInjectable = getInjectable({
  id: "resource-slice-detail-item",

  instantiate(di) {
    return {
      Component: ResourceSliceDetails,
      isFor: isResourceSlice,
      orderNumber: 10,
    };
  },

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isResourceSlice = kubeObjectMatchesToKindAndApiVersion("ResourceSlice", ["resource.k8s.io/v1"]);

export default resourceSliceDetailItemInjectable;
