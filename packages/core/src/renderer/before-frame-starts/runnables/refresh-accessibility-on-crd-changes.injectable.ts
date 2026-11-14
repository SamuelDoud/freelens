import { noop } from "@freelensapp/utilities";
import { getInjectable } from "@ogre-tools/injectable";
import { reaction } from "mobx";
import { clusterRefreshAccessibilityChannel } from "../../../common/ipc/cluster";
import hostedClusterIdInjectable from "../../cluster-frame-context/hosted-cluster-id.injectable";
import customResourceDefinitionStoreInjectable from "../../components/custom-resource-definitions/store.injectable";
import ipcRendererInjectable from "../../utils/channel/ipc-renderer.injectable";
import { beforeClusterFrameStartsSecondInjectionToken } from "../tokens";

const refreshAccessibilityOnCrdChangesInjectable = getInjectable({
  id: "refresh-accessibility-on-crd-changes",
  instantiate: (di) => ({
    run: () => {
      const crdStore = di.inject(customResourceDefinitionStoreInjectable);
      const hostedClusterId = di.inject(hostedClusterIdInjectable);
      const ipcRenderer = di.inject(ipcRendererInjectable);

      let debounceTimer: NodeJS.Timeout | undefined;

      reaction(
        // Nothing until the CRDs have loaded: the load itself is not a change,
        // and the cluster's connection has just refreshed its accessibility.
        () =>
          crdStore.isLoaded
            ? crdStore
                .getItems()
                .map((crd) => crd.getId())
                .sort()
                .join(",")
            : undefined,
        (currentIds, previousIds) => {
          // Only react to actual changes of the loaded CRDs
          if (!hostedClusterId || currentIds === undefined || previousIds === undefined) return;

          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            ipcRenderer.invoke(clusterRefreshAccessibilityChannel, hostedClusterId).catch(noop);
          }, 400);
        },
      );
    },
  }),
  injectionToken: beforeClusterFrameStartsSecondInjectionToken,
});

export default refreshAccessibilityOnCrdChangesInjectable;
