/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { VolumeAttributesClassDetails } from "../../../storage-volume-attributes-classes";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const volumeAttributesClassDetailItemInjectable = getInjectable({
  id: "volume-attributes-class-detail-item",

  instantiate(di) {
    return {
      Component: VolumeAttributesClassDetails,
      isFor: isVolumeAttributesClass,
      orderNumber: 10,
    };
  },

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isVolumeAttributesClass = kubeObjectMatchesToKindAndApiVersion("VolumeAttributesClass", [
  "storage.k8s.io/v1",
]);

export default volumeAttributesClassDetailItemInjectable;
