/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import { VolumeAttachmentDetails } from "../../../storage-volume-attachments";
import currentKubeObjectInDetailsInjectable from "../../current-kube-object-in-details.injectable";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const volumeAttachmentDetailItemInjectable = getInjectable({
  id: "volume-attachment-detail-item",

  instantiate(di) {
    const kubeObject = di.inject(currentKubeObjectInDetailsInjectable);

    return {
      Component: VolumeAttachmentDetails,
      enabled: computed(() => isVolumeAttachment(kubeObject.value.get()?.object)),
      orderNumber: 10,
    };
  },

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isVolumeAttachment = kubeObjectMatchesToKindAndApiVersion("VolumeAttachment", ["storage.k8s.io/v1"]);

export default volumeAttachmentDetailItemInjectable;
