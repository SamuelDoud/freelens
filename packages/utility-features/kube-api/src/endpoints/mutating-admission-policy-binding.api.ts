/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { MutatingAdmissionPolicyBinding } from "@freelensapp/kube-object";
import { KubeApi } from "../kube-api";

import type { DerivedKubeApiOptions, KubeApiDependencies } from "../kube-api";

export class MutatingAdmissionPolicyBindingApi extends KubeApi<MutatingAdmissionPolicyBinding> {
  constructor(deps: KubeApiDependencies, opts?: DerivedKubeApiOptions) {
    super(deps, {
      // 1.34 and 1.35 serve these kinds as v1beta1 when their feature gate is on.
      checkPreferredVersion: true,
      fallbackApiBases: ["/apis/admissionregistration.k8s.io/v1beta1/mutatingadmissionpolicybindings"],
      ...(opts ?? {}),
      objectConstructor: MutatingAdmissionPolicyBinding,
    });
  }
}
