/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import { StorageVersionMigrationDetails } from "../../../config-storage-version-migrations";
import currentKubeObjectInDetailsInjectable from "../../current-kube-object-in-details.injectable";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const storageVersionMigrationDetailItemInjectable = getInjectable({
  id: "storage-version-migration-detail-item",

  instantiate(di) {
    const kubeObject = di.inject(currentKubeObjectInDetailsInjectable);

    return {
      Component: StorageVersionMigrationDetails,
      enabled: computed(() => isStorageVersionMigration(kubeObject.value.get()?.object)),
      orderNumber: 10,
    };
  },

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isStorageVersionMigration = kubeObjectMatchesToKindAndApiVersion("StorageVersionMigration", [
  "storagemigration.k8s.io/v1",
]);

export default storageVersionMigrationDetailItemInjectable;
