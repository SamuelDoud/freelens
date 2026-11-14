/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { ValidatingAdmissionPolicyDetails } from "../../../config-validating-admission-policies";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const validatingAdmissionPolicyDetailItemInjectable = getInjectable({
  id: "validating-admission-policy-detail-item",

  instantiate(di) {
    return {
      Component: ValidatingAdmissionPolicyDetails,
      isFor: isValidatingAdmissionPolicy,
      orderNumber: 10,
    };
  },

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isValidatingAdmissionPolicy = kubeObjectMatchesToKindAndApiVersion("ValidatingAdmissionPolicy", [
  "v1",
  "admissionregistration.k8s.io/v1beta1",
  "admissionregistration.k8s.io/v1",
]);

export default validatingAdmissionPolicyDetailItemInjectable;
