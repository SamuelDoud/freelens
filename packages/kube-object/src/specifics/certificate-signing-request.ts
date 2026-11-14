/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeObject } from "../kube-object";

import type { BaseKubeObjectCondition, ClusterScopedMetadata } from "../api-types";

export interface CertificateSigningRequestSpec {
  request?: string;
  signerName?: string;
  expirationSeconds?: number;
  usages?: string[];
  username?: string;
  uid?: string;
  groups?: string[];
  extra?: Partial<Record<string, string[]>>;
}

export interface CertificateSigningRequestStatus {
  conditions?: BaseKubeObjectCondition[];
  certificate?: string;
}

export class CertificateSigningRequest extends KubeObject<
  ClusterScopedMetadata,
  CertificateSigningRequestStatus,
  CertificateSigningRequestSpec
> {
  static readonly kind = "CertificateSigningRequest";

  static readonly namespaced = false;

  static readonly apiBase = "/apis/certificates.k8s.io/v1/certificatesigningrequests";

  isApproved(): boolean {
    return (
      this.status?.conditions?.some((condition) => condition.type === "Approved" && condition.status === "True") ??
      false
    );
  }

  isDenied(): boolean {
    return (
      this.status?.conditions?.some((condition) => condition.type === "Denied" && condition.status === "True") ?? false
    );
  }

  isPending(): boolean {
    return !this.isApproved() && !this.isDenied();
  }

  /** As kubectl shows it: Pending, Approved, Approved,Issued, Denied or Failed. */
  getCondition(): string {
    if (this.isPending()) {
      return "Pending";
    }

    const types = (this.status?.conditions ?? [])
      .filter((condition) => condition.status === "True")
      .map((condition) => condition.type);

    return [...types, ...(this.status?.certificate ? ["Issued"] : [])].join(",");
  }
}
