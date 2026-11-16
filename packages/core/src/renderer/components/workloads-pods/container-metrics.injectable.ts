/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import requestPodMetricsInjectable from "../../../common/k8s-api/endpoints/metrics.api/request-pod-metrics.injectable";
import { createTimeRangedMetricsInjectable } from "../resource-metrics/create-time-ranged-metrics";

import type { Container, Pod } from "@freelensapp/kube-object";

interface PodContainerParams {
  pod: Pod;
  container: Container;
}

const podContainerMetricsInjectable = createTimeRangedMetricsInjectable({
  id: "pod-container-metrics",
  getObject: ({ pod, container }: PodContainerParams) => ({ pod, container }),
  getObjectId: ({ pod, container }) => `${pod.getId()}-${container.name}`,
  request: ({ di, object: { pod, container }, start, end, range, step }) =>
    di.inject(requestPodMetricsInjectable)([pod], pod.getNs(), container, "pod, container, namespace", {
      start,
      end,
      range,
      step,
      // The requests and limits drawn as reference lines come from the pod spec.
      metrics: ["cpuUsage", "memoryUsage", "fsUsage", "fsWrites", "fsReads"],
    }),
});

export default podContainerMetricsInjectable;
