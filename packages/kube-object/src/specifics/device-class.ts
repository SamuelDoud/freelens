/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeObject } from "../kube-object";

import type { ClusterScopedMetadata } from "../api-types";

export interface DeviceSelector {
  cel?: { expression: string };
}

export interface DeviceClassSpec {
  selectors?: DeviceSelector[];
  config?: unknown[];
  extendedResourceName?: string;
}

export class DeviceClass extends KubeObject<ClusterScopedMetadata, void, DeviceClassSpec> {
  static readonly kind = "DeviceClass";

  static readonly namespaced = false;

  static readonly apiBase = "/apis/resource.k8s.io/v1/deviceclasses";
}
