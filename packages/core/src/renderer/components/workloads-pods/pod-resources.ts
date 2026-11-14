/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { parseQuantity } from "../../../common/utils/k8s-quantity";

import type { Container, Pod } from "@freelensapp/kube-object";

export type ResourceName = "cpu" | "memory";

/** Requests and limits in cores (CPU) and bytes (memory); `undefined` when not set. */
export interface ResourceAmounts {
  readonly cpuRequest?: number;
  readonly cpuLimit?: number;
  readonly memoryRequest?: number;
  readonly memoryLimit?: number;
}

type Kind = "requests" | "limits";

const amountOf = (container: Container, kind: Kind, resource: ResourceName) =>
  parseQuantity(container.resources?.[kind]?.[resource]);

export function getContainerResources(container: Container): ResourceAmounts {
  return {
    cpuRequest: amountOf(container, "requests", "cpu"),
    cpuLimit: amountOf(container, "limits", "cpu"),
    memoryRequest: amountOf(container, "requests", "memory"),
    memoryLimit: amountOf(container, "limits", "memory"),
  };
}

/**
 * What the pod as a whole requests or is limited to, the way the scheduler
 * counts it: its containers and sidecars add up, an init container runs next
 * to the sidecars started before it, the larger of the two counts, and the
 * pod's overhead comes on top.
 *
 * A request no container sets is `undefined`. A limit is `undefined` when any
 * container lacks it, since that container, and so the pod, is unbounded.
 */
function getPodAmount(pod: Pod, kind: Kind, resource: ResourceName): number | undefined {
  const containers = pod.getContainers();
  const initContainers = pod.getInitContainers();
  const amounts = [...containers, ...initContainers].map((container) => amountOf(container, kind, resource));

  if (kind === "limits" ? amounts.some((amount) => amount === undefined) : amounts.every((a) => a === undefined)) {
    return undefined;
  }

  let sidecars = 0;
  let initPeak = 0;

  for (const container of initContainers) {
    const amount = amountOf(container, kind, resource) ?? 0;

    if (container.restartPolicy === "Always") {
      sidecars += amount;
    } else {
      initPeak = Math.max(initPeak, sidecars + amount);
    }
  }

  const running = containers.reduce((sum, container) => sum + (amountOf(container, kind, resource) ?? 0), sidecars);
  const overhead = parseQuantity(pod.spec?.overhead?.[resource]) ?? 0;

  return Math.max(running, initPeak) + overhead;
}

export function getPodResources(pod: Pod): ResourceAmounts {
  return {
    cpuRequest: getPodAmount(pod, "requests", "cpu"),
    cpuLimit: getPodAmount(pod, "limits", "cpu"),
    memoryRequest: getPodAmount(pod, "requests", "memory"),
    memoryLimit: getPodAmount(pod, "limits", "memory"),
  };
}
