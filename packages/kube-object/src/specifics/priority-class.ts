/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeObject } from "../kube-object";

import type { ClusterScopedMetadata, KubeJsonApiData, KubeObjectMetadata, KubeObjectScope } from "../api-types";
import type { PreemptionPolicy } from "../types/preemption-policy";

export interface PriorityClassData extends KubeJsonApiData<KubeObjectMetadata<KubeObjectScope.Cluster>, void, void> {
  description?: string;
  globalDefault?: boolean;
  preemptionPolicy?: PreemptionPolicy;
  value: number;
}

export class PriorityClass extends KubeObject<ClusterScopedMetadata, void, void> {
  static readonly kind = "PriorityClass";

  static readonly namespaced = false;

  static readonly apiBase = "/apis/scheduling.k8s.io/v1/priorityclasses";

  description?: string;

  globalDefault?: boolean;

  preemptionPolicy?: PreemptionPolicy;

  value?: number;

  constructor(data: PriorityClassData) {
    super(data);
    this.description = data.description;
    this.globalDefault = data.globalDefault;
    this.preemptionPolicy = data.preemptionPolicy;
    this.value = data.value;
  }

  getDescription() {
    return this.description || "";
  }

  getGlobalDefault() {
    return (this.globalDefault || false).toString();
  }

  getPreemptionPolicy() {
    return this.preemptionPolicy || "PreemptLowerPriority";
  }

  getValue() {
    return this.value;
  }
}
