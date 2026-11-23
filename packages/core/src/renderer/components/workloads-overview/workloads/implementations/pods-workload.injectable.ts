/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import navigateToPodsInjectable from "../../../../../common/front-end-routing/routes/cluster/workloads/pods/navigate-to-pods.injectable";
import podRowStoreInjectable from "../../../../../features/rows-service/renderer/pods-list/pod-row-store.injectable";
import podsFromRowsInjectable from "../../../../../features/rows-service/renderer/pods-list/pods-from-rows.injectable";
import { ResourceNames } from "../../../../utils/rbac";
import podStoreInjectable from "../../../workloads-pods/store.injectable";
import { workloadInjectionToken } from "../workload-injection-token";

const podsWorkloadInjectable = getInjectable({
  id: "pods-workload",

  instantiate: (di) => {
    const navigate = di.inject(navigateToPodsInjectable);
    const store = di.inject(podStoreInjectable);
    // With the rows service, the counts come from the pod rows, so the overview loads no full pod
    const fromRows = di.inject(podsFromRowsInjectable);
    const rowStore = di.inject(podRowStoreInjectable);

    return {
      resource: {
        apiName: "pods",
        group: "",
      },
      open: navigate,

      amountOfItems: computed(() => (fromRows.get() ? rowStore.contextItems : store.contextItems).length),

      status: computed(() =>
        fromRows.get() ? rowStore.getStatuses(rowStore.contextItems) : store.getStatuses(store.contextItems),
      ),

      title: ResourceNames.pods,
      orderNumber: 10,
    };
  },

  injectionToken: workloadInjectionToken,
});

export default podsWorkloadInjectable;
