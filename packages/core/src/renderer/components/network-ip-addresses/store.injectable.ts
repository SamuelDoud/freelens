/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { ipAddressApiInjectable, storesAndApisCanBeCreatedInjectionToken } from "@freelensapp/kube-api-specifics";
import { loggerInjectionToken } from "@freelensapp/logger";
import { getInjectable } from "@ogre-tools/injectable";
import { kubeObjectStoreInjectionToken } from "../../../common/k8s-api/api-manager/kube-object-store-token";
import clusterFrameContextForClusterScopedResourcesInjectable from "../../cluster-frame-context/for-cluster-scoped-resources.injectable";
import { IPAddressStore } from "./store";

const ipAddressStoreInjectable = getInjectable({
  id: "ip-address-store",
  instantiate: (di) => {
    if (!di.inject(storesAndApisCanBeCreatedInjectionToken)) {
      throw new Error("ipAddressStore is only available in certain environments");
    }

    return new IPAddressStore(
      {
        context: di.inject(clusterFrameContextForClusterScopedResourcesInjectable),
        logger: di.inject(loggerInjectionToken),
      },
      di.inject(ipAddressApiInjectable),
    );
  },
  injectionToken: kubeObjectStoreInjectionToken,
});

export default ipAddressStoreInjectable;
