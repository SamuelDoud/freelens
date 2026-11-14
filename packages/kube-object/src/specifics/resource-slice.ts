/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeObject } from "../kube-object";

import type { ClusterScopedMetadata } from "../api-types";

export interface ResourceSliceDevice {
  name: string;
  attributes?: Partial<Record<string, unknown>>;
  capacity?: Partial<Record<string, unknown>>;
}

export interface ResourceSliceSpec {
  driver?: string;
  nodeName?: string;
  allNodes?: boolean;
  pool?: { name?: string; generation?: number; resourceSliceCount?: number };
  devices?: ResourceSliceDevice[];
}

export class ResourceSlice extends KubeObject<ClusterScopedMetadata, void, ResourceSliceSpec> {
  static readonly kind = "ResourceSlice";

  static readonly namespaced = false;

  static readonly apiBase = "/apis/resource.k8s.io/v1/resourceslices";

  getDevices(): ResourceSliceDevice[] {
    return this.spec?.devices ?? [];
  }
}
