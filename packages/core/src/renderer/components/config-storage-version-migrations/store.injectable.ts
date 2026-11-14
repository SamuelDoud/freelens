/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import {
  storageVersionMigrationApiInjectable,
  storesAndApisCanBeCreatedInjectionToken,
} from "@freelensapp/kube-api-specifics";
import { loggerInjectionToken } from "@freelensapp/logger";
import { getInjectable } from "@ogre-tools/injectable";
import { kubeObjectStoreInjectionToken } from "../../../common/k8s-api/api-manager/kube-object-store-token";
import clusterFrameContextForClusterScopedResourcesInjectable from "../../cluster-frame-context/for-cluster-scoped-resources.injectable";
import { StorageVersionMigrationStore } from "./store";

const storageVersionMigrationStoreInjectable = getInjectable({
  id: "storage-version-migration-store",
  instantiate: (di) => {
    if (!di.inject(storesAndApisCanBeCreatedInjectionToken)) {
      throw new Error("storageVersionMigrationStore is only available in certain environments");
    }

    return new StorageVersionMigrationStore(
      {
        context: di.inject(clusterFrameContextForClusterScopedResourcesInjectable),
        logger: di.inject(loggerInjectionToken),
      },
      di.inject(storageVersionMigrationApiInjectable),
    );
  },
  injectionToken: kubeObjectStoreInjectionToken,
});

export default storageVersionMigrationStoreInjectable;
