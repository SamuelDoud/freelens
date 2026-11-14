/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { VolumeAttachmentDetails } from "../../../storage-volume-attachments";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const volumeAttachmentDetailItemInjectable = getInjectable({
  id: "volume-attachment-detail-item",

  instantiate(di) {
    return {
      Component: VolumeAttachmentDetails,
      isFor: isVolumeAttachment,
      orderNumber: 10,
    };
  },

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isVolumeAttachment = kubeObjectMatchesToKindAndApiVersion("VolumeAttachment", ["storage.k8s.io/v1"]);

export default volumeAttachmentDetailItemInjectable;
