/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import {
  priorityLevelConfigurationApiInjectable,
  storesAndApisCanBeCreatedInjectionToken,
} from "@freelensapp/kube-api-specifics";
import { loggerInjectionToken } from "@freelensapp/logger";
import { getInjectable } from "@ogre-tools/injectable";
import { kubeObjectStoreInjectionToken } from "../../../common/k8s-api/api-manager/kube-object-store-token";
import clusterFrameContextForClusterScopedResourcesInjectable from "../../cluster-frame-context/for-cluster-scoped-resources.injectable";
import { PriorityLevelConfigurationStore } from "./store";

const priorityLevelConfigurationStoreInjectable = getInjectable({
  id: "priority-level-configuration-store",
  instantiate: (di) => {
    if (!di.inject(storesAndApisCanBeCreatedInjectionToken)) {
      throw new Error("priorityLevelConfigurationStore is only available in certain environments");
    }

    return new PriorityLevelConfigurationStore(
      {
        context: di.inject(clusterFrameContextForClusterScopedResourcesInjectable),
        logger: di.inject(loggerInjectionToken),
      },
      di.inject(priorityLevelConfigurationApiInjectable),
    );
  },
  injectionToken: kubeObjectStoreInjectionToken,
});

export default priorityLevelConfigurationStoreInjectable;
