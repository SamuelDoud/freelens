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

type ContainerAmounts = [
  request: ResourceAmounts["cpuRequest"],
  limit: ResourceAmounts["cpuLimit"],
  memoryRequest: ResourceAmounts["memoryRequest"],
  memoryLimit: ResourceAmounts["memoryLimit"],
];

const amountsOf = (container: Container): ContainerAmounts => [
  amountOf(container, "requests", "cpu"),
  amountOf(container, "limits", "cpu"),
  amountOf(container, "requests", "memory"),
  amountOf(container, "limits", "memory"),
];

/**
 * What the pod as a whole requests or is limited to, the way the scheduler
 * counts it: its containers and sidecars add up, an init container runs next
 * to the sidecars started before it, the larger of the two counts, and the
 * pod's overhead comes on top.
 *
 * A request no container sets is `undefined`. A limit is `undefined` when any
 * container lacks it, since that container, and so the pod, is unbounded.
 *
 * `slot` is the position of the amount in a container's amounts.
 */
function getPodAmount(
  containers: Container[],
  initContainers: Container[],
  containerAmounts: ContainerAmounts[],
  initAmounts: ContainerAmounts[],
  slot: 0 | 1 | 2 | 3,
  overhead: number,
): number | undefined {
  const isLimit = slot === 1 || slot === 3;
  const pick = (amounts: ContainerAmounts[], index: number) => amounts[index][slot];
  const count = containers.length + initContainers.length;
  let undefinedCount = 0;

  for (let index = 0; index < containers.length; index++) {
    if (pick(containerAmounts, index) === undefined) undefinedCount++;
  }

  for (let index = 0; index < initContainers.length; index++) {
    if (pick(initAmounts, index) === undefined) undefinedCount++;
  }

  // An empty pod has every request unset (every() of nothing) and every limit set (some() of nothing).
  if (isLimit ? undefinedCount > 0 : undefinedCount === count) {
    return undefined;
  }

  let sidecars = 0;
  let initPeak = 0;

  for (let index = 0; index < initContainers.length; index++) {
    const amount = pick(initAmounts, index) ?? 0;

    if (initContainers[index].restartPolicy === "Always") {
      sidecars += amount;
    } else {
      initPeak = Math.max(initPeak, sidecars + amount);
    }
  }

  let running = sidecars;

  for (let index = 0; index < containers.length; index++) {
    running += pick(containerAmounts, index) ?? 0;
  }

  return Math.max(running, initPeak) + overhead;
}

function computePodResources(pod: Pod): ResourceAmounts {
  const containers = pod.getContainers();
  const initContainers = pod.getInitContainers();
  // Each container is read once, for all four amounts.
  const containerAmounts = containers.map(amountsOf);
  const initAmounts = initContainers.map(amountsOf);
  const cpuOverhead = parseQuantity(pod.spec?.overhead?.cpu) ?? 0;
  const memoryOverhead = parseQuantity(pod.spec?.overhead?.memory) ?? 0;

  return {
    cpuRequest: getPodAmount(containers, initContainers, containerAmounts, initAmounts, 0, cpuOverhead),
    cpuLimit: getPodAmount(containers, initContainers, containerAmounts, initAmounts, 1, cpuOverhead),
    memoryRequest: getPodAmount(containers, initContainers, containerAmounts, initAmounts, 2, memoryOverhead),
    memoryLimit: getPodAmount(containers, initContainers, containerAmounts, initAmounts, 3, memoryOverhead),
  };
}

// A pod object is never changed after it is made (a watch event makes a new one), so what it
// requests is worked out once for it, and goes with it.
const resourcesByPod = new WeakMap<Pod, ResourceAmounts>();

/** The amounts of a pod. The same frozen object for the same pod object. */
export function getPodResources(pod: Pod): ResourceAmounts {
  let resources = resourcesByPod.get(pod);

  if (!resources) {
    resources = Object.freeze(computePodResources(pod));
    resourcesByPod.set(pod, resources);
  }

  return resources;
}
