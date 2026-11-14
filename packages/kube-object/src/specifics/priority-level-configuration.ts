/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeObject } from "../kube-object";

import type { BaseKubeObjectCondition, ClusterScopedMetadata } from "../api-types";

export interface PriorityLevelConfigurationSpec {
  type?: "Exempt" | "Limited";
  limited?: {
    nominalConcurrencyShares?: number;
    lendablePercent?: number;
    borrowingLimitPercent?: number;
    limitResponse?: { type?: string; queuing?: { queues?: number; handSize?: number; queueLengthLimit?: number } };
  };
  exempt?: { nominalConcurrencyShares?: number; lendablePercent?: number };
}

export interface PriorityLevelConfigurationStatus {
  conditions?: BaseKubeObjectCondition[];
}

export class PriorityLevelConfiguration extends KubeObject<
  ClusterScopedMetadata,
  PriorityLevelConfigurationStatus,
  PriorityLevelConfigurationSpec
> {
  static readonly kind = "PriorityLevelConfiguration";

  static readonly namespaced = false;

  static readonly apiBase = "/apis/flowcontrol.apiserver.k8s.io/v1/prioritylevelconfigurations";
}
