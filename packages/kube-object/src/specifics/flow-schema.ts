/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeObject } from "../kube-object";

import type { BaseKubeObjectCondition, ClusterScopedMetadata } from "../api-types";

export interface FlowSchemaSpec {
  priorityLevelConfiguration?: { name: string };
  matchingPrecedence?: number;
  distinguisherMethod?: { type: string };
  rules?: unknown[];
}

export interface FlowSchemaStatus {
  conditions?: BaseKubeObjectCondition[];
}

export class FlowSchema extends KubeObject<ClusterScopedMetadata, FlowSchemaStatus, FlowSchemaSpec> {
  static readonly kind = "FlowSchema";

  static readonly namespaced = false;

  static readonly apiBase = "/apis/flowcontrol.apiserver.k8s.io/v1/flowschemas";
}
