/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { DeviceClassDetails } from "../../../devices-device-classes";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const deviceClassDetailItemInjectable = getInjectable({
  id: "device-class-detail-item",

  instantiate(di) {
    return {
      Component: DeviceClassDetails,
      isFor: isDeviceClass,
      orderNumber: 10,
    };
  },

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isDeviceClass = kubeObjectMatchesToKindAndApiVersion("DeviceClass", ["resource.k8s.io/v1"]);

export default deviceClassDetailItemInjectable;
