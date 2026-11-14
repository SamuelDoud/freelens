/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeObject } from "../kube-object";

import type { ClusterScopedMetadata } from "../api-types";

export interface IPAddressSpec {
  parentRef?: { group?: string; resource?: string; namespace?: string; name?: string };
}

export class IPAddress extends KubeObject<ClusterScopedMetadata, void, IPAddressSpec> {
  static readonly kind = "IPAddress";

  static readonly namespaced = false;

  static readonly apiBase = "/apis/networking.k8s.io/v1/ipaddresses";

  getParent(): string {
    const parent = this.spec?.parentRef;

    return parent
      ? `${parent.resource ?? ""} ${parent.namespace ? `${parent.namespace}/` : ""}${parent.name ?? ""}`.trim()
      : "";
  }
}
