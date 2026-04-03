/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { reaction } from "mobx";
import { KubeObjectStore } from "../../../common/k8s-api/kube-object.store";
import userPreferencesStateInjectable from "../../../features/user-preferences/common/state.injectable";
import initUserStoreInjectable from "../../../features/user-preferences/renderer/load-storage.injectable";
import { beforeFrameStartsSecondInjectionToken } from "../tokens";

const syncListPageSizePreferenceInjectable = getInjectable({
  id: "sync-list-page-size-preference",
  instantiate: (di) => ({
    run: () => {
      const state = di.inject(userPreferencesStateInjectable);

      reaction(
        () => state.listPageSize,
        (pageSize) => {
          KubeObjectStore.defaultListPageSize = pageSize;
        },
        { fireImmediately: true },
      );
    },
    runAfter: initUserStoreInjectable,
  }),
  injectionToken: beforeFrameStartsSecondInjectionToken,
});

export default syncListPageSizePreferenceInjectable;
