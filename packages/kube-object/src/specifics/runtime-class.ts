/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeObject } from "../kube-object";

import type {
  ClusterScopedMetadata,
  KubeJsonApiData,
  KubeObjectMetadata,
  KubeObjectScope,
  Toleration,
} from "../api-types";

export interface RuntimeClassData extends KubeJsonApiData<KubeObjectMetadata<KubeObjectScope.Cluster>, void, void> {
  handler: string;
  overhead?: RuntimeClassOverhead;
  scheduling?: RuntimeClassScheduling;
}

export interface RuntimeClassOverhead {
  podFixed?: string;
}

export interface RuntimeClassScheduling {
  nodeSelector?: Partial<Record<string, string>>;
  tolerations?: Toleration[];
}

export class RuntimeClass extends KubeObject<ClusterScopedMetadata, void, void> {
  static readonly kind = "RuntimeClass";

  static readonly namespaced = false;

  static readonly apiBase = "/apis/node.k8s.io/v1/runtimeclasses";

  handler: string;

  overhead?: RuntimeClassOverhead;

  scheduling?: RuntimeClassScheduling;

  constructor(data: RuntimeClassData) {
    super(data);
    this.handler = data.handler;
    this.overhead = data.overhead;
    this.scheduling = data.scheduling;
  }

  getHandler() {
    return this.handler;
  }

  getPodFixed() {
    return this.overhead?.podFixed ?? "";
  }

  getNodeSelectors(): string[] {
    return Object.entries(this.scheduling?.nodeSelector ?? {}).map((values) => values.join(": "));
  }

  getTolerations() {
    return this.scheduling?.tolerations ?? [];
  }
}
