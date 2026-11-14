/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { Pod } from "@freelensapp/kube-object";

/** The value a pod without owner references gets, so a search can find standalone pods. */
export const standalonePodKind = "None";

/**
 * The kinds of the workloads that control a pod, for searching by what kind of pod it is: the kinds
 * of its owner references, as the "Controlled By" column shows them, plus "Deployment" for a pod of
 * a ReplicaSet that a Deployment manages. The Deployment controller labels the pods of its
 * ReplicaSets with `pod-template-hash`, so the pod alone tells, without the ReplicaSet being loaded.
 */
export function getPodControllerKinds(pod: Pod): string[] {
  const kinds = pod.getOwnerRefs().map((ref) => ref.kind);

  if (kinds.length === 0) {
    return [standalonePodKind];
  }

  if (kinds.includes("ReplicaSet") && pod.metadata.labels?.["pod-template-hash"] !== undefined) {
    kinds.push("Deployment");
  }

  return kinds;
}
