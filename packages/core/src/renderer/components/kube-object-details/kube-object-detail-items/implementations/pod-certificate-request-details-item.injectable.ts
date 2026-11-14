/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import { PodCertificateRequestDetails } from "../../../user-management-pod-certificate-requests";
import currentKubeObjectInDetailsInjectable from "../../current-kube-object-in-details.injectable";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const podCertificateRequestDetailItemInjectable = getInjectable({
  id: "pod-certificate-request-detail-item",

  instantiate(di) {
    const kubeObject = di.inject(currentKubeObjectInDetailsInjectable);

    return {
      Component: PodCertificateRequestDetails,
      enabled: computed(() => isPodCertificateRequest(kubeObject.value.get()?.object)),
      orderNumber: 10,
    };
  },

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isPodCertificateRequest = kubeObjectMatchesToKindAndApiVersion("PodCertificateRequest", [
  "certificates.k8s.io/v1",
]);

export default podCertificateRequestDetailItemInjectable;
