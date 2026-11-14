/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import autoBind from "auto-bind";
import { KubeObject } from "../kube-object";

import type { KubeJsonApiData, NamespaceScopedMetadata } from "../api-types";

export interface CSIStorageCapacityData extends KubeJsonApiData<NamespaceScopedMetadata, void, void> {
  storageClassName?: string;
  capacity?: string;
  maximumVolumeSize?: string;
  nodeTopology?: unknown;
}

export class CSIStorageCapacity extends KubeObject<NamespaceScopedMetadata, void, void> {
  static readonly kind = "CSIStorageCapacity";

  static readonly namespaced = true;

  static readonly apiBase = "/apis/storage.k8s.io/v1/csistoragecapacities";

  storageClassName: string;

  capacity: string | undefined;

  maximumVolumeSize: string | undefined;

  nodeTopology: unknown;

  constructor({ storageClassName = "", capacity, maximumVolumeSize, nodeTopology, ...rest }: CSIStorageCapacityData) {
    super(rest);
    autoBind(this);
    this.storageClassName = storageClassName;
    this.capacity = capacity;
    this.maximumVolumeSize = maximumVolumeSize;
    this.nodeTopology = nodeTopology;
  }
}
