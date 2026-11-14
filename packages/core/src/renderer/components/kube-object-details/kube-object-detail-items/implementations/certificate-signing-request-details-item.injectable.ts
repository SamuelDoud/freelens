/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { CertificateSigningRequestDetails } from "../../../user-management-certificate-signing-requests";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const certificateSigningRequestDetailItemInjectable = getInjectable({
  id: "certificate-signing-request-detail-item",

  instantiate(di) {
    return {
      Component: CertificateSigningRequestDetails,
      isFor: isCertificateSigningRequest,
      orderNumber: 10,
    };
  },

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isCertificateSigningRequest = kubeObjectMatchesToKindAndApiVersion("CertificateSigningRequest", [
  "certificates.k8s.io/v1",
]);

export default certificateSigningRequestDetailItemInjectable;
