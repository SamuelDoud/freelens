/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeObject } from "../kube-object";

import type { ClusterScopedMetadata } from "../api-types";

export interface VolumeAttachmentSpec {
  attacher?: string;
  nodeName?: string;
  source?: { persistentVolumeName?: string; inlineVolumeSpec?: unknown };
}

export interface VolumeAttachmentStatus {
  attached?: boolean;
  attachError?: { message?: string; time?: string };
  detachError?: { message?: string; time?: string };
  attachmentMetadata?: Partial<Record<string, string>>;
}

export class VolumeAttachment extends KubeObject<ClusterScopedMetadata, VolumeAttachmentStatus, VolumeAttachmentSpec> {
  static readonly kind = "VolumeAttachment";

  static readonly namespaced = false;

  static readonly apiBase = "/apis/storage.k8s.io/v1/volumeattachments";
}
