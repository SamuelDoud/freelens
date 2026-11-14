/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeObject } from "../kube-object";

import type { ClusterScopedMetadata } from "../api-types";

export interface ClusterTrustBundleSpec {
  signerName?: string;
  trustBundle?: string;
}

export class ClusterTrustBundle extends KubeObject<ClusterScopedMetadata, void, ClusterTrustBundleSpec> {
  static readonly kind = "ClusterTrustBundle";

  static readonly namespaced = false;

  static readonly apiBase = "/apis/certificates.k8s.io/v1/clustertrustbundles";

  getCertificateCount(): number {
    return (this.spec?.trustBundle?.match(/-----BEGIN CERTIFICATE-----/g) ?? []).length;
  }
}
