/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { DeviceTaintRule } from "@freelensapp/kube-object";
import { KubeApi } from "../kube-api";

import type { DerivedKubeApiOptions, KubeApiDependencies } from "../kube-api";

export class DeviceTaintRuleApi extends KubeApi<DeviceTaintRule> {
  constructor(deps: KubeApiDependencies, opts?: DerivedKubeApiOptions) {
    super(deps, {
      // The group is served as v1beta1 or v1alpha1 on older clusters; use the newest version it serves.
      checkPreferredVersion: true,
      ...(opts ?? {}),
      objectConstructor: DeviceTaintRule,
    });
  }
}
