/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { cpuUnitsToNumber, unitsToBytes } from "@freelensapp/utilities";
import { countBy } from "es-toolkit/compat";
import { computed, observable } from "mobx";
import { KubeObjectStore } from "../../../common/k8s-api/kube-object.store";
import { RetryBackoff } from "../../utils/retry-backoff";

import type { PodApi, PodMetricsApi } from "@freelensapp/kube-api";
import type { KubeObject, NamespaceScopedMetadata, Pod, PodMetrics } from "@freelensapp/kube-object";

import type { IComputedValue } from "mobx";

import type { KubeObjectStoreDependencies, KubeObjectStoreOptions } from "../../../common/k8s-api/kube-object.store";

export interface PodStoreDependencies extends KubeObjectStoreDependencies {
  readonly podMetricsApi: PodMetricsApi;
  /**
   * Whether the cluster serves pod metrics (metrics.k8s.io, from
   * metrics-server). Without it the metrics are not requested at all.
   */
  readonly isMetricsApiAvailable?: IComputedValue<boolean>;
}

export class PodStore extends KubeObjectStore<Pod, PodApi> {
  constructor(
    protected readonly dependencies: PodStoreDependencies,
    api: PodApi,
    opts?: KubeObjectStoreOptions,
  ) {
    super(dependencies, api, opts);
  }

  readonly kubeMetrics = observable.array<PodMetrics>([]);

  @computed get kubeMetricsByPod(): Map<string, PodMetrics> {
    const map = new Map<string, PodMetrics>();

    for (const metric of this.kubeMetrics) {
      map.set(`${metric.getNs()}/${metric.getName()}`, metric);
    }

    return map;
  }

  private readonly kubeMetricsBackoff = new RetryBackoff();

  /**
   * Loads pod metrics from metrics-server. The views poll it, so it is not
   * requested on a cluster that does not serve it, and requested less and
   * less often while it keeps failing.
   */
  async loadKubeMetrics(namespace?: string) {
    if (this.dependencies.isMetricsApiAvailable?.get() === false || !this.kubeMetricsBackoff.canAttempt()) {
      return;
    }

    try {
      const metrics = await this.dependencies.podMetricsApi.list({ namespace });

      this.kubeMetrics.replace(metrics ?? []);
      this.kubeMetricsBackoff.succeeded();
    } catch (error) {
      this.kubeMetricsBackoff.failed();
      console.warn("loadKubeMetrics failed", error);
    }
  }

  // Reverse indexes over the pod list, so that the per-workload lookups
  // below stay O(1) instead of scanning every pod on every call. They are
  // rebuilt by MobX only when the items change. The lookups return copies:
  // handing out the cached arrays would let a caller that sorts or splices
  // its result corrupt the index for everyone else.
  @computed private get podsByOwnerId(): Map<string, Pod[]> {
    const map = new Map<string, Pod[]>();

    for (const pod of this.items) {
      // metadata directly, not getOwnerRefs(): the index only needs the
      // uids, without the namespace-enriched copies that returns. The set
      // keeps a pod with a repeated owner reference listed once per owner,
      // as the filter this replaces did.
      for (const uid of new Set((pod.metadata.ownerReferences ?? []).map((owner) => owner.uid))) {
        const pods = map.get(uid);

        if (pods) {
          pods.push(pod);
        } else {
          map.set(uid, [pod]);
        }
      }
    }

    return map;
  }

  @computed private get podsByNode(): Map<string, Pod[]> {
    const map = new Map<string, Pod[]>();

    for (const pod of this.items) {
      const nodeName = pod.spec?.nodeName;

      if (nodeName) {
        const pods = map.get(nodeName);

        if (pods) {
          pods.push(pod);
        } else {
          map.set(nodeName, [pod]);
        }
      }
    }

    return map;
  }

  @computed private get podsByPvc(): Map<string, Pod[]> {
    const map = new Map<string, Pod[]>();

    for (const pod of this.items) {
      const claimNames = new Set<string>();

      for (const volume of pod.getVolumes()) {
        const claimName = volume.persistentVolumeClaim?.claimName;

        if (claimName) {
          claimNames.add(claimName);
        }
      }

      // A pod mounting one claim through several volumes is still one pod
      // using that claim, matching PersistentVolumeClaim.getPods().
      for (const claimName of claimNames) {
        const key = `${pod.getNs()}/${claimName}`;
        const pods = map.get(key);

        if (pods) {
          pods.push(pod);
        } else {
          map.set(key, [pod]);
        }
      }
    }

    return map;
  }

  getPodsByOwner(workload: KubeObject<NamespaceScopedMetadata, unknown, unknown>): Pod[] {
    return this.getPodsByOwnerId(workload.getId());
  }

  getPodsByOwnerId(workloadId: string): Pod[] {
    return [...(this.podsByOwnerId.get(workloadId) ?? [])];
  }

  getPodsByNode(node: string) {
    if (!this.isLoaded) return [];

    return [...(this.podsByNode.get(node) ?? [])];
  }

  getPodsByPvc(namespace: string, claimName: string): Pod[] {
    return [...(this.podsByPvc.get(`${namespace}/${claimName}`) ?? [])];
  }

  getStatuses(pods: Pod[]) {
    return countBy(
      pods
        .map((pod) => pod.getStatus())
        .sort()
        .reverse(),
    );
  }

  getPodKubeMetrics(pod: Pod) {
    const containers = pod.getContainers();
    const empty = { cpu: 0, memory: 0 };
    const metrics = this.kubeMetricsByPod.get(`${pod.getNs()}/${pod.getName()}`);

    if (!metrics || !metrics.containers || !containers) return { cpu: NaN, memory: NaN };

    return containers.reduce((total, container) => {
      let cpu = "0";
      let memory = "0";

      const metric = metrics.containers?.find((item) => item.name == container.name);

      if (metric && metric.usage) {
        cpu = metric.usage.cpu || "0";
        memory = metric.usage.memory || "0";
      }

      return {
        cpu: total.cpu + (cpuUnitsToNumber(cpu) ?? 0),
        memory: total.memory + unitsToBytes(memory),
      };
    }, empty);
  }
}
