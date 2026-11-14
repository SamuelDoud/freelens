/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { formatCpuQuantity, formatMemoryQuantity } from "../../../../common/utils/k8s-quantity";
import { getPodResources } from "../pod-resources";

import type { Pod } from "@freelensapp/kube-object";
import type { SpecificKubeListLayoutColumn } from "@freelensapp/list-layout";

import type { ResourceAmounts } from "../pod-resources";

export type PodResourceColumnId = keyof ResourceAmounts;

export const podResourceColumnIds: readonly PodResourceColumnId[] = [
  "cpuRequest",
  "cpuLimit",
  "memoryRequest",
  "memoryLimit",
];

const titles: Record<PodResourceColumnId, string> = {
  cpuRequest: "CPU request",
  cpuLimit: "CPU limit",
  memoryRequest: "Memory request",
  memoryLimit: "Memory limit",
};

export const formatPodResource = (id: PodResourceColumnId, amount: number | undefined) => {
  if (amount === undefined) {
    return undefined;
  }

  return id.startsWith("cpu") ? formatCpuQuantity(amount) : formatMemoryQuantity(amount);
};

/** A column of the pod list with one of the pod's requests or limits. */
export const createPodResourceColumn = (
  id: PodResourceColumnId,
  priority: number,
): SpecificKubeListLayoutColumn<Pod> => ({
  id,
  priority,
  content: (pod: Pod) => formatPodResource(id, getPodResources(pod)[id]) ?? "—",
  header: { title: titles[id], className: id, sortBy: id, id },
  // Pods without the amount sort first.
  sortingCallBack: (pod: Pod) => getPodResources(pod)[id] ?? -1,
});
