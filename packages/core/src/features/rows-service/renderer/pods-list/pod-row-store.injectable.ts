/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { reaction } from "mobx";
import clusterFrameContextForNamespacedResourcesInjectable from "../../../../renderer/cluster-frame-context/for-namespaced-resources.injectable";
import hostedClusterInjectable from "../../../../renderer/cluster-frame-context/hosted-cluster.injectable";
import { apiRowsPrefix } from "../../common/api-rows-prefix";
import rowsServiceEnabledInjectable from "../../common/rows-service-enabled.injectable";
import { PodRowStore } from "./pod-row-store";

/** The rows of the Pods list, from the rows service of the cluster of this frame. */
const podRowStoreInjectable = getInjectable({
  id: "pod-row-store",
  instantiate: (di) => {
    const context = di.inject(clusterFrameContextForNamespacedResourcesInjectable);
    const hostedCluster = di.inject(hostedClusterInjectable);

    const enabled = di.inject(rowsServiceEnabledInjectable);
    const store = new PodRowStore({
      fetch: (input, init) => globalThis.fetch(input, init),
      baseUrl: apiRowsPrefix,
      getContextNamespaces: () => context.contextNamespaces,
      hideCompletedPods: () => hostedCluster?.preferences.hideCompletedPods ?? false,
    });

    // Turning the option off and on again tries the rows service again
    reaction(
      () => enabled.get(),
      () => store.resetUnavailable(),
    );

    return store;
  },
});

export default podRowStoreInjectable;
