/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import navigateToDaemonsetsInjectable from "../../../../../common/front-end-routing/routes/cluster/workloads/daemonsets/navigate-to-daemonsets.injectable";
import { ResourceNames } from "../../../../utils/rbac";
import daemonsetsStoreInjectable from "../../../workloads-daemonsets/store.injectable";
import { workloadInjectionToken } from "../workload-injection-token";

const daemonsetsWorkloadInjectable = getInjectable({
  id: "daemonsets-workload",

  instantiate: (di) => {
    const navigate = di.inject(navigateToDaemonsetsInjectable);
    const store = di.inject(daemonsetsStoreInjectable);

    return {
      resource: {
        apiName: "daemonsets",
        group: "apps",
      },
      open: navigate,

      amountOfItems: computed(() => store.contextItems.length),

      status: computed(() => store.getStatuses(store.contextItems)),

      title: ResourceNames.daemonsets,
      orderNumber: 30,
    };
  },

  injectionToken: workloadInjectionToken,
});

export default daemonsetsWorkloadInjectable;
