/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeObject } from "../kube-object";

import type { ClusterScopedMetadata, KubeJsonApiData, KubeObjectMetadata, KubeObjectScope } from "../api-types";
import type { AggregationRule } from "../types/aggregation-rule";
import type { PolicyRule } from "../types/policy-rule";

export interface ClusterRoleData extends KubeJsonApiData<KubeObjectMetadata<KubeObjectScope.Cluster>, void, void> {
  rules?: PolicyRule[];
  aggregationRule?: AggregationRule;
}

export class ClusterRole extends KubeObject<ClusterScopedMetadata, void, void> {
  static kind = "ClusterRole";

  static namespaced = false;

  static apiBase = "/apis/rbac.authorization.k8s.io/v1/clusterroles";

  rules?: PolicyRule[];

  aggregationRule?: AggregationRule;

  constructor(data: ClusterRoleData) {
    super(data);
    this.rules = data.rules;
    this.aggregationRule = data.aggregationRule;
  }

  getRules() {
    return this.rules || [];
  }
}
