/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { deviceTaintRuleApiInjectable, storesAndApisCanBeCreatedInjectionToken } from "@freelensapp/kube-api-specifics";
import { loggerInjectionToken } from "@freelensapp/logger";
import { getInjectable } from "@ogre-tools/injectable";
import { kubeObjectStoreInjectionToken } from "../../../common/k8s-api/api-manager/kube-object-store-token";
import clusterFrameContextForClusterScopedResourcesInjectable from "../../cluster-frame-context/for-cluster-scoped-resources.injectable";
import { DeviceTaintRuleStore } from "./store";

const deviceTaintRuleStoreInjectable = getInjectable({
  id: "device-taint-rule-store",
  instantiate: (di) => {
    if (!di.inject(storesAndApisCanBeCreatedInjectionToken)) {
      throw new Error("deviceTaintRuleStore is only available in certain environments");
    }

    return new DeviceTaintRuleStore(
      {
        context: di.inject(clusterFrameContextForClusterScopedResourcesInjectable),
        logger: di.inject(loggerInjectionToken),
      },
      di.inject(deviceTaintRuleApiInjectable),
    );
  },
  injectionToken: kubeObjectStoreInjectionToken,
});

export default deviceTaintRuleStoreInjectable;
