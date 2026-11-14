/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { ClusterTrustBundleDetails } from "../../../user-management-cluster-trust-bundles";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const clusterTrustBundleDetailItemInjectable = getInjectable({
  id: "cluster-trust-bundle-detail-item",

  instantiate(di) {
    return {
      Component: ClusterTrustBundleDetails,
      isFor: isClusterTrustBundle,
      orderNumber: 10,
    };
  },

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isClusterTrustBundle = kubeObjectMatchesToKindAndApiVersion("ClusterTrustBundle", [
  "certificates.k8s.io/v1",
]);

export default clusterTrustBundleDetailItemInjectable;
