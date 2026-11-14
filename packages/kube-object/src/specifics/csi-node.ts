/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeObject } from "../kube-object";

import type { ClusterScopedMetadata } from "../api-types";

export interface CSINodeDriver {
  name: string;
  nodeID?: string;
  topologyKeys?: string[];
  allocatable?: { count?: number };
}

export interface CSINodeSpec {
  drivers?: CSINodeDriver[];
}

export class CSINode extends KubeObject<ClusterScopedMetadata, void, CSINodeSpec> {
  static readonly kind = "CSINode";

  static readonly namespaced = false;

  static readonly apiBase = "/apis/storage.k8s.io/v1/csinodes";

  getDrivers(): CSINodeDriver[] {
    return this.spec?.drivers ?? [];
  }
}
