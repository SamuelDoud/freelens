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

  @computed private get replicaSetsByOwnerId(): Map<string, ReplicaSet[]> {
    const map = new Map<string, ReplicaSet[]>();

    for (const rs of this.items) {
      for (const ref of rs.metadata.ownerReferences ?? []) {
        let list = map.get(ref.uid);

        if (!list) {
          list = [];
          map.set(ref.uid, list);
        }

        list.push(rs);
      }
    }

    return map;
  }

  getReplicaSetsByOwner(deployment: Deployment) {
    return this.replicaSetsByOwnerId.get(deployment.getId()) ?? [];
  }
}
