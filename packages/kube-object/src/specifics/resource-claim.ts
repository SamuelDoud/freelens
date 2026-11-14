/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeObject } from "../kube-object";

import type { NamespaceScopedMetadata } from "../api-types";

export interface DeviceRequest {
  name: string;
  exactly?: { deviceClassName?: string; count?: number; allocationMode?: string };
  firstAvailable?: { name: string; deviceClassName?: string }[];
}

export interface ResourceClaimSpec {
  devices?: { requests?: DeviceRequest[]; constraints?: unknown[]; config?: unknown[] };
}

export interface ResourceClaimStatus {
  allocation?: { devices?: { results?: { request: string; driver: string; pool: string; device: string }[] } };
  reservedFor?: { resource?: string; name?: string; uid?: string }[];
}

export class ResourceClaim extends KubeObject<NamespaceScopedMetadata, ResourceClaimStatus, ResourceClaimSpec> {
  static readonly kind = "ResourceClaim";

  static readonly namespaced = true;

  static readonly apiBase = "/apis/resource.k8s.io/v1/resourceclaims";

  getRequests(): DeviceRequest[] {
    return this.spec?.devices?.requests ?? [];
  }

  /** As kubectl shows it: pending, allocated, or allocated and reserved. */
  getState(): string {
    if (!this.status?.allocation) {
      return "pending";
    }

    return this.status.reservedFor?.length ? "allocated,reserved" : "allocated";
  }
}
