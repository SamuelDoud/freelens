/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { JobDetails } from "../../../workloads-jobs";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const jobDetailItemInjectable = getInjectable({
  id: "job-detail-item",

  instantiate: () => ({
    Component: JobDetails,
    isFor: isJob,
    orderNumber: 10,
  }),

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isJob = kubeObjectMatchesToKindAndApiVersion("Job", ["batch/v1"]);

export default jobDetailItemInjectable;
