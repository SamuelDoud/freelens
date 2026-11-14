/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { MutatingAdmissionPolicyBindingDetails } from "../../../config-mutating-admission-policy-bindings";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const mutatingAdmissionPolicyBindingDetailItemInjectable = getInjectable({
  id: "mutating-admission-policy-binding-detail-item",

  instantiate(di) {
    return {
      Component: MutatingAdmissionPolicyBindingDetails,
      isFor: isMutatingAdmissionPolicyBinding,
      orderNumber: 10,
    };
  },

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isMutatingAdmissionPolicyBinding = kubeObjectMatchesToKindAndApiVersion("MutatingAdmissionPolicyBinding", [
  "v1",
  "admissionregistration.k8s.io/v1beta1",
  "admissionregistration.k8s.io/v1",
]);

export default mutatingAdmissionPolicyBindingDetailItemInjectable;
