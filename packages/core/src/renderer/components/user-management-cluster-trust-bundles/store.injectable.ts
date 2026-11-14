/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import {
  clusterTrustBundleApiInjectable,
  storesAndApisCanBeCreatedInjectionToken,
} from "@freelensapp/kube-api-specifics";
import { loggerInjectionToken } from "@freelensapp/logger";
import { getInjectable } from "@ogre-tools/injectable";
import { kubeObjectStoreInjectionToken } from "../../../common/k8s-api/api-manager/kube-object-store-token";
import clusterFrameContextForClusterScopedResourcesInjectable from "../../cluster-frame-context/for-cluster-scoped-resources.injectable";
import { ClusterTrustBundleStore } from "./store";

const clusterTrustBundleStoreInjectable = getInjectable({
  id: "cluster-trust-bundle-store",
  instantiate: (di) => {
    if (!di.inject(storesAndApisCanBeCreatedInjectionToken)) {
      throw new Error("clusterTrustBundleStore is only available in certain environments");
    }

    return new ClusterTrustBundleStore(
      {
        context: di.inject(clusterFrameContextForClusterScopedResourcesInjectable),
        logger: di.inject(loggerInjectionToken),
      },
      di.inject(clusterTrustBundleApiInjectable),
    );
  },
  injectionToken: kubeObjectStoreInjectionToken,
});

export default clusterTrustBundleStoreInjectable;
