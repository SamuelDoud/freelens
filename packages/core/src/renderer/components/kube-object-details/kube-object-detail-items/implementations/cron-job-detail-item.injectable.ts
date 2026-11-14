/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { CronJobDetails } from "../../../workloads-cronjobs";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const cronJobDetailItemInjectable = getInjectable({
  id: "cron-job-detail-item",

  instantiate: () => ({
    Component: CronJobDetails,
    isFor: isCronJob,
    orderNumber: 10,
  }),

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export default cronJobDetailItemInjectable;

export const isCronJob = kubeObjectMatchesToKindAndApiVersion("CronJob", ["batch/v1"]);
