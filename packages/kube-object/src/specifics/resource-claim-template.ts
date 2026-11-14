/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeObject } from "../kube-object";

import type { NamespaceScopedMetadata } from "../api-types";

export interface ResourceClaimTemplateSpec {
  metadata?: unknown;
  spec?: { devices?: { requests?: { name: string; exactly?: { deviceClassName?: string; count?: number } }[] } };
}

export class ResourceClaimTemplate extends KubeObject<NamespaceScopedMetadata, void, ResourceClaimTemplateSpec> {
  static readonly kind = "ResourceClaimTemplate";

  static readonly namespaced = true;

  static readonly apiBase = "/apis/resource.k8s.io/v1/resourceclaimtemplates";

  getRequestNames(): string[] {
    return (this.spec?.spec?.devices?.requests ?? []).map((request) => request.name);
  }
}
