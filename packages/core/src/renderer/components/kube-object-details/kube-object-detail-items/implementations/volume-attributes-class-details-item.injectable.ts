/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import { VolumeAttributesClassDetails } from "../../../storage-volume-attributes-classes";
import currentKubeObjectInDetailsInjectable from "../../current-kube-object-in-details.injectable";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const volumeAttributesClassDetailItemInjectable = getInjectable({
  id: "volume-attributes-class-detail-item",

  instantiate(di) {
    const kubeObject = di.inject(currentKubeObjectInDetailsInjectable);

    return {
      Component: VolumeAttributesClassDetails,
      enabled: computed(() => isVolumeAttributesClass(kubeObject.value.get()?.object)),
      orderNumber: 10,
    };
  },

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isVolumeAttributesClass = kubeObjectMatchesToKindAndApiVersion("VolumeAttributesClass", [
  "storage.k8s.io/v1",
]);

export default volumeAttributesClassDetailItemInjectable;
