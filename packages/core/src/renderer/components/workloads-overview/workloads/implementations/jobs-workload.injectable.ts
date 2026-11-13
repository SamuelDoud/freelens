/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import navigateToJobsInjectable from "../../../../../common/front-end-routing/routes/cluster/workloads/jobs/navigate-to-jobs.injectable";
import { ResourceNames } from "../../../../utils/rbac";
import jobStoreInjectable from "../../../workloads-jobs/store.injectable";
import { workloadInjectionToken } from "../workload-injection-token";

const jobsWorkloadInjectable = getInjectable({
  id: "jobs-workload",

  instantiate: (di) => {
    const navigate = di.inject(navigateToJobsInjectable);
    const store = di.inject(jobStoreInjectable);

    return {
      resource: {
        apiName: "jobs",
        group: "batch",
      },
      open: navigate,

      amountOfItems: computed(() => store.contextItems.length),

      status: computed(() => store.getStatuses(store.contextItems)),

      title: ResourceNames.jobs,
      orderNumber: 60,
    };
  },

  injectionToken: workloadInjectionToken,
});

export default jobsWorkloadInjectable;
