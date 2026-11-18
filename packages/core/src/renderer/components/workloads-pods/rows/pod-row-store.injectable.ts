/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import clusterFrameContextForNamespacedResourcesInjectable from "../../../cluster-frame-context/for-namespaced-resources.injectable";
import hostedClusterInjectable from "../../../cluster-frame-context/hosted-cluster.injectable";
import { PodRowStore } from "./pod-row-store";

/** The rows of the Pods list, from the rows service of the cluster of this frame. */
const podRowStoreInjectable = getInjectable({
  id: "pod-row-store",
  instantiate: (di) => {
    const context = di.inject(clusterFrameContextForNamespacedResourcesInjectable);
    const hostedCluster = di.inject(hostedClusterInjectable);

    return new PodRowStore({
      fetch: (input, init) => globalThis.fetch(input, init),
      baseUrl: "/api-rows",
      getContextNamespaces: () => context.contextNamespaces,
      hideCompletedPods: () => hostedCluster?.preferences.hideCompletedPods ?? false,
    });
  },
});

export default podRowStoreInjectable;
