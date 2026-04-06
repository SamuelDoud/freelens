/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeObject } from "../kube-object";

import type { ClusterScopedMetadata, KubeJsonApiData, KubeObjectMetadata, KubeObjectScope } from "../api-types";

export interface TopologySelectorLabelRequirement {
  key: string;
  values: string[];
}

export interface TopologySelectorTerm {
  matchLabelExpressions?: TopologySelectorLabelRequirement[];
}

export interface StorageClassData extends KubeJsonApiData<KubeObjectMetadata<KubeObjectScope.Cluster>, void, void> {
  allowVolumeExpansion?: boolean;
  allowedTopologies?: TopologySelectorTerm[];
  mountOptions?: string[];
  parameters?: Partial<Record<string, string>>;
  provisioner: string;
  reclaimPolicy?: string;
  volumeBindingMode?: string;
}

export class StorageClass extends KubeObject<ClusterScopedMetadata, void, void> {
  static readonly kind = "StorageClass";

  static readonly namespaced = false;

  static readonly apiBase = "/apis/storage.k8s.io/v1/storageclasses";

  allowVolumeExpansion?: boolean;

  allowedTopologies: TopologySelectorTerm[];

  mountOptions: string[];

  parameters: Partial<Record<string, string>>;

  provisioner: string;

  reclaimPolicy: string;

  volumeBindingMode?: string;

  constructor(data: StorageClassData) {
    super(data);
    this.allowVolumeExpansion = data.allowVolumeExpansion;
    this.allowedTopologies = data.allowedTopologies ?? [];
    this.mountOptions = data.mountOptions ?? [];
    this.parameters = data.parameters ?? {};
    this.provisioner = data.provisioner;
    this.reclaimPolicy = data.reclaimPolicy ?? "Delete";
    this.volumeBindingMode = data.volumeBindingMode;
  }

  isDefault() {
    const annotations = this.metadata.annotations || {};

    return (
      annotations["storageclass.kubernetes.io/is-default-class"] === "true" ||
      annotations["storageclass.beta.kubernetes.io/is-default-class"] === "true"
    );
  }

  getVolumeBindingMode() {
    return this.volumeBindingMode || "-";
  }

  getReclaimPolicy() {
    return this.reclaimPolicy || "-";
  }
}
