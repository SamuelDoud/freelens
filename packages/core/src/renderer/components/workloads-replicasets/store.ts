/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { PodStatusPhase } from "@freelensapp/kube-object";
import { computed } from "mobx";
import { KubeObjectStore } from "../../../common/k8s-api/kube-object.store";

import type { ReplicaSetApi } from "@freelensapp/kube-api";
import type { Deployment, ReplicaSet } from "@freelensapp/kube-object";

import type { KubeObjectStoreDependencies, KubeObjectStoreOptions } from "../../../common/k8s-api/kube-object.store";
import type { GetPodsByOwnerId } from "../workloads-pods/get-pods-by-owner-id.injectable";

export interface ReplicaSetStoreDependencies extends KubeObjectStoreDependencies {
  getPodsByOwnerId: GetPodsByOwnerId;
}

export class ReplicaSetStore extends KubeObjectStore<ReplicaSet, ReplicaSetApi> {
  constructor(
    protected readonly dependencies: ReplicaSetStoreDependencies,
    api: ReplicaSetApi,
    opts?: KubeObjectStoreOptions,
  ) {
    super(dependencies, api, opts);
  }

  /**
   * @deprecated Switch to using `getPodsByOwnerId` directly
   */
  getChildPods(replicaSet: ReplicaSet) {
    return this.dependencies.getPodsByOwnerId(replicaSet.getId());
  }

  getStatuses(replicaSets: ReplicaSet[]) {
    const status = { running: 0, failed: 0, pending: 0 };

    for (const replicaSet of replicaSets) {
      const statuses = new Set(this.getChildPods(replicaSet).map((pod) => pod.getStatus()));

      if (statuses.has(PodStatusPhase.FAILED)) {
        status.failed++;
      } else if (statuses.has(PodStatusPhase.PENDING)) {
        status.pending++;
      } else {
        status.running++;
      }
    }

    return status;
  }

  // Replica sets by owner uid, so that getReplicaSetsByOwner stays O(1)
  // instead of scanning every replica set. Rebuilt by MobX only when the
  // items change; lookups return copies so that a caller sorting its
  // result cannot corrupt the cached index.
  @computed private get replicaSetsByOwnerId(): Map<string, ReplicaSet[]> {
    const map = new Map<string, ReplicaSet[]>();

    for (const replicaSet of this.items) {
      // The set keeps a replica set with a repeated owner reference listed
      // once per owner, as the filter this replaces did.
      for (const uid of new Set((replicaSet.metadata.ownerReferences ?? []).map((owner) => owner.uid))) {
        const replicaSets = map.get(uid);

        if (replicaSets) {
          replicaSets.push(replicaSet);
        } else {
          map.set(uid, [replicaSet]);
        }
      }
    }

    return map;
  }

  getReplicaSetsByOwner(deployment: Deployment) {
    return [...(this.replicaSetsByOwnerId.get(deployment.getId()) ?? [])];
  }
}
