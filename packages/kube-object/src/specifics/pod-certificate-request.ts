/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeObject } from "../kube-object";

import type { BaseKubeObjectCondition, NamespaceScopedMetadata } from "../api-types";

export interface PodCertificateRequestSpec {
  signerName?: string;
  podName?: string;
  podUID?: string;
  serviceAccountName?: string;
  nodeName?: string;
  maxExpirationSeconds?: number;
}

export interface PodCertificateRequestStatus {
  conditions?: BaseKubeObjectCondition[];
  notBefore?: string;
  notAfter?: string;
  beginRefreshAt?: string;
}

export class PodCertificateRequest extends KubeObject<
  NamespaceScopedMetadata,
  PodCertificateRequestStatus,
  PodCertificateRequestSpec
> {
  static readonly kind = "PodCertificateRequest";

  static readonly namespaced = true;

  static readonly apiBase = "/apis/certificates.k8s.io/v1/podcertificaterequests";
}
