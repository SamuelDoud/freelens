/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeObject } from "../kube-object";

import type { ClusterScopedMetadata } from "../api-types";

export interface DeviceTaintRuleSpec {
  deviceSelector?: { deviceClassName?: string; driver?: string; pool?: string; device?: string; selectors?: unknown[] };
  taint?: { key: string; value?: string; effect: string; timeAdded?: string };
}

export class DeviceTaintRule extends KubeObject<ClusterScopedMetadata, void, DeviceTaintRuleSpec> {
  static readonly kind = "DeviceTaintRule";

  static readonly namespaced = false;

  static readonly apiBase = "/apis/resource.k8s.io/v1/devicetaintrules";

  getTaint(): string {
    const taint = this.spec?.taint;

    return taint ? `${taint.key}${taint.value ? `=${taint.value}` : ""}:${taint.effect}` : "";
  }
}
