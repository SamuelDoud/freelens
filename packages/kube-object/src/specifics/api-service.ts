/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeObject } from "../kube-object";

import type { BaseKubeObjectCondition, ClusterScopedMetadata } from "../api-types";

export interface APIServiceSpec {
  group?: string;
  version?: string;
  service?: { namespace?: string; name?: string; port?: number };
  groupPriorityMinimum?: number;
  versionPriority?: number;
  insecureSkipTLSVerify?: boolean;
}

export interface APIServiceStatus {
  conditions?: BaseKubeObjectCondition[];
}

export class APIService extends KubeObject<ClusterScopedMetadata, APIServiceStatus, APIServiceSpec> {
  static readonly kind = "APIService";

  static readonly namespaced = false;

  static readonly apiBase = "/apis/apiregistration.k8s.io/v1/apiservices";

  getServiceName(): string {
    const service = this.spec?.service;

    return service ? `${service.namespace}/${service.name}` : "Local";
  }

  getAvailability(): string {
    const available = this.status?.conditions?.find((condition) => condition.type === "Available");

    return available ? `${available.status}${available.status === "True" ? "" : ` (${available.reason ?? ""})`}` : "";
  }
}
