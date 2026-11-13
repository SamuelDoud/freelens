/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { PodStatusPhase } from "@freelensapp/kube-object";
import { computed } from "mobx";
import { KubeObjectStore } from "../../../common/k8s-api/kube-object.store";

import type { JobApi } from "@freelensapp/kube-api";
import type { CronJob, Job, Pod } from "@freelensapp/kube-object";

import type { KubeObjectStoreDependencies, KubeObjectStoreOptions } from "../../../common/k8s-api/kube-object.store";
import type { GetPodsByOwnerId } from "../workloads-pods/get-pods-by-owner-id.injectable";

interface Dependencies extends KubeObjectStoreDependencies {
  getPodsByOwnerId: GetPodsByOwnerId;
}

export class JobStore extends KubeObjectStore<Job, JobApi> {
  constructor(
    protected readonly dependencies: Dependencies,
    api: JobApi,
    opts?: KubeObjectStoreOptions,
  ) {
    super(dependencies, api, opts);
  }

  /**
   * @deprecated Switch to using `getPodsByOwnerId` directly
   */
  getChildPods(job: Job): Pod[] {
    return this.dependencies.getPodsByOwnerId(job.getId());
  }

  // Jobs by "namespace/kind/name" of an owner reference, so that
  // getJobsByOwner stays O(1) instead of scanning every job. Rebuilt by
  // MobX only when the items change; lookups return copies so that a
  // caller sorting its result cannot corrupt the cached index.
  @computed private get jobsByOwner(): Map<string, Job[]> {
    const map = new Map<string, Job[]>();

    for (const job of this.items) {
      // The set keeps a job with a repeated owner reference listed once
      // per owner, as the filter this replaces did.
      const keys = new Set((job.metadata.ownerReferences ?? []).map((ref) => `${job.getNs()}/${ref.kind}/${ref.name}`));

      for (const key of keys) {
        const jobs = map.get(key);

        if (jobs) {
          jobs.push(job);
        } else {
          map.set(key, [job]);
        }
      }
    }

    return map;
  }

  getJobsByOwner(cronJob: CronJob) {
    return [...(this.jobsByOwner.get(`${cronJob.getNs()}/${cronJob.kind}/${cronJob.getName()}`) ?? [])];
  }

  getStatuses(jobs?: Job[]) {
    const status = { succeeded: 0, running: 0, failed: 0, pending: 0 };

    for (const job of jobs ?? []) {
      const statuses = new Set(this.getChildPods(job).map((pod) => pod.getStatus()));

      if (statuses.has(PodStatusPhase.FAILED)) {
        status.failed++;
      } else if (statuses.has(PodStatusPhase.PENDING)) {
        status.pending++;
      } else if (statuses.has(PodStatusPhase.RUNNING)) {
        status.running++;
      } else {
        status.succeeded++;
      }
    }

    return status;
  }
}
