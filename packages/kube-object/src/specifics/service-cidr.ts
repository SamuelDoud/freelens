/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeObject } from "../kube-object";

import type { BaseKubeObjectCondition, ClusterScopedMetadata } from "../api-types";

export interface ServiceCIDRSpec {
  cidrs?: string[];
}

export interface ServiceCIDRStatus {
  conditions?: BaseKubeObjectCondition[];
}

export class ServiceCIDR extends KubeObject<ClusterScopedMetadata, ServiceCIDRStatus, ServiceCIDRSpec> {
  static readonly kind = "ServiceCIDR";

  static readonly namespaced = false;

  static readonly apiBase = "/apis/networking.k8s.io/v1/servicecidrs";
}
