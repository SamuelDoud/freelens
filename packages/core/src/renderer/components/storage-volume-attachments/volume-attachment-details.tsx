/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observer } from "mobx-react";
import { ResourceDetailItem, YamlDetails } from "../resource-details/detail-items";

import type { VolumeAttachment } from "@freelensapp/kube-object";

import type { KubeObjectDetailsProps } from "../kube-object-details";

export const VolumeAttachmentDetails = observer(({ object }: KubeObjectDetailsProps<VolumeAttachment>) => (
  <div className="VolumeAttachmentDetails">
    <ResourceDetailItem name="Attacher" value={object.spec?.attacher} />
    <ResourceDetailItem name="Persistent Volume" value={object.spec?.source?.persistentVolumeName} />
    <ResourceDetailItem name="Node" value={object.spec?.nodeName} />
    <ResourceDetailItem name="Attached" value={object.status?.attached ? "Yes" : "No"} />
    <ResourceDetailItem name="Attach Error" value={object.status?.attachError?.message} />
    <ResourceDetailItem name="Detach Error" value={object.status?.detachError?.message} />
    <YamlDetails title="Attachment Metadata" value={object.status?.attachmentMetadata} />
  </div>
));
