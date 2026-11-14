/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import {
  resourceClaimTemplateApiInjectable,
  storesAndApisCanBeCreatedInjectionToken,
} from "@freelensapp/kube-api-specifics";
import { loggerInjectionToken } from "@freelensapp/logger";
import { getInjectable } from "@ogre-tools/injectable";
import { kubeObjectStoreInjectionToken } from "../../../common/k8s-api/api-manager/kube-object-store-token";
import clusterFrameContextForNamespacedResourcesInjectable from "../../cluster-frame-context/for-namespaced-resources.injectable";
import { ResourceClaimTemplateStore } from "./store";

const resourceClaimTemplateStoreInjectable = getInjectable({
  id: "resource-claim-template-store",
  instantiate: (di) => {
    if (!di.inject(storesAndApisCanBeCreatedInjectionToken)) {
      throw new Error("resourceClaimTemplateStore is only available in certain environments");
    }

    return new ResourceClaimTemplateStore(
      {
        context: di.inject(clusterFrameContextForNamespacedResourcesInjectable),
        logger: di.inject(loggerInjectionToken),
      },
      di.inject(resourceClaimTemplateApiInjectable),
    );
  },
  injectionToken: kubeObjectStoreInjectionToken,
});

export default resourceClaimTemplateStoreInjectable;
