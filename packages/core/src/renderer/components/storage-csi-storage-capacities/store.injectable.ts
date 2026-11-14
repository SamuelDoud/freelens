/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import {
  csiStorageCapacityApiInjectable,
  storesAndApisCanBeCreatedInjectionToken,
} from "@freelensapp/kube-api-specifics";
import { loggerInjectionToken } from "@freelensapp/logger";
import { getInjectable } from "@ogre-tools/injectable";
import { kubeObjectStoreInjectionToken } from "../../../common/k8s-api/api-manager/kube-object-store-token";
import clusterFrameContextForNamespacedResourcesInjectable from "../../cluster-frame-context/for-namespaced-resources.injectable";
import { CSIStorageCapacityStore } from "./store";

const csiStorageCapacityStoreInjectable = getInjectable({
  id: "csi-storage-capacity-store",
  instantiate: (di) => {
    if (!di.inject(storesAndApisCanBeCreatedInjectionToken)) {
      throw new Error("csiStorageCapacityStore is only available in certain environments");
    }

    return new CSIStorageCapacityStore(
      {
        context: di.inject(clusterFrameContextForNamespacedResourcesInjectable),
        logger: di.inject(loggerInjectionToken),
      },
      di.inject(csiStorageCapacityApiInjectable),
    );
  },
  injectionToken: kubeObjectStoreInjectionToken,
});

export default csiStorageCapacityStoreInjectable;
