/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeObject } from "../kube-object";

import type { ClusterScopedMetadata } from "../api-types";

export interface CSIDriverSpec {
  attachRequired?: boolean;
  podInfoOnMount?: boolean;
  storageCapacity?: boolean;
  fsGroupPolicy?: string;
  volumeLifecycleModes?: string[];
  requiresRepublish?: boolean;
  seLinuxMount?: boolean;
  tokenRequests?: { audience: string; expirationSeconds?: number }[];
}

export class CSIDriver extends KubeObject<ClusterScopedMetadata, void, CSIDriverSpec> {
  static readonly kind = "CSIDriver";

  static readonly namespaced = false;

  static readonly apiBase = "/apis/storage.k8s.io/v1/csidrivers";
}
