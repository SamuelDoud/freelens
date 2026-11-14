/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeObject } from "../kube-object";

import type { BaseKubeObjectCondition, ClusterScopedMetadata } from "../api-types";

export interface StorageVersionMigrationSpec {
  resource?: { group?: string; version?: string; resource?: string };
}

export interface StorageVersionMigrationStatus {
  conditions?: BaseKubeObjectCondition[];
  resourceVersion?: string;
}

export class StorageVersionMigration extends KubeObject<
  ClusterScopedMetadata,
  StorageVersionMigrationStatus,
  StorageVersionMigrationSpec
> {
  static readonly kind = "StorageVersionMigration";

  static readonly namespaced = false;

  static readonly apiBase = "/apis/storagemigration.k8s.io/v1/storageversionmigrations";

  getResource(): string {
    const resource = this.spec?.resource;

    return resource ? [resource.resource, resource.group].filter(Boolean).join(".") : "";
  }
}
