/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import navigateToStatefulsetsInjectable from "../../../../../common/front-end-routing/routes/cluster/workloads/statefulsets/navigate-to-statefulsets.injectable";
import { ResourceNames } from "../../../../utils/rbac";
import statefulsetsStoreInjectable from "../../../workloads-statefulsets/store.injectable";
import { workloadInjectionToken } from "../workload-injection-token";

const statefulsetsWorkloadInjectable = getInjectable({
  id: "statefulsets-workload",

  instantiate: (di) => {
    const navigate = di.inject(navigateToStatefulsetsInjectable);
    const store = di.inject(statefulsetsStoreInjectable);

    return {
      resource: {
        apiName: "statefulsets",
        group: "apps",
      },
      open: navigate,

      amountOfItems: computed(() => store.contextItems.length),

      status: computed(() => store.getStatuses(store.contextItems)),

      title: ResourceNames.statefulsets,
      orderNumber: 40,
    };
  },

  injectionToken: workloadInjectionToken,
});

export default statefulsetsWorkloadInjectable;
