/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import navigateToPodsInjectable from "../../../../../common/front-end-routing/routes/cluster/workloads/pods/navigate-to-pods.injectable";
import { ResourceNames } from "../../../../utils/rbac";
import podStoreInjectable from "../../../workloads-pods/store.injectable";
import { workloadInjectionToken } from "../workload-injection-token";

const podsWorkloadInjectable = getInjectable({
  id: "pods-workload",

  instantiate: (di) => {
    const navigate = di.inject(navigateToPodsInjectable);
    const store = di.inject(podStoreInjectable);

    return {
      resource: {
        apiName: "pods",
        group: "",
      },
      open: navigate,

      amountOfItems: computed(() => store.contextItems.length),

      status: computed(() => store.getStatuses(store.contextItems)),

      title: ResourceNames.pods,
      orderNumber: 10,
    };
  },

  injectionToken: workloadInjectionToken,
});

export default podsWorkloadInjectable;
