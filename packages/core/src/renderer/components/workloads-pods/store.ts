/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { cpuUnitsToNumber, unitsToBytes } from "@freelensapp/utilities";
import { computed, observable } from "mobx";
import { KubeObjectStore } from "../../../common/k8s-api/kube-object.store";
import { RetryBackoff } from "../../utils/retry-backoff";

import type { KubeApiQueryParams, PodApi, PodMetricsApi } from "@freelensapp/kube-api";
import type {
  KubeObject,
  NamespaceScopedMetadata,
  PersistentVolumeClaim,
  Pod,
  PodMetrics,
} from "@freelensapp/kube-object";

import type { IComputedValue } from "mobx";

import type { KubeObjectStoreDependencies, KubeObjectStoreOptions } from "../../../common/k8s-api/kube-object.store";

export interface PodStoreDependencies extends KubeObjectStoreDependencies {
  readonly podMetricsApi: PodMetricsApi;
  /**
   * Whether the cluster serves pod metrics (metrics.k8s.io, from
   * metrics-server). Without it the metrics are not requested at all.
   */
  readonly isMetricsApiAvailable?: IComputedValue<boolean>;
  /**
   * Whether pods that ran to completion are left out, as the cluster's
   * `hideCompletedPods` preference says.
   */
  readonly hideCompletedPods?: () => boolean;
}

const isForbidden = (error: unknown): boolean => {
  const { code, status } = (error ?? {}) as { code?: unknown; status?: unknown };

  return code === 403 || status === 403;
};

export class PodStore extends KubeObjectStore<Pod, PodApi> {
  constructor(
    protected readonly dependencies: PodStoreDependencies,
    api: PodApi,
    opts?: KubeObjectStoreOptions,
  ) {
    super(dependencies, api, opts);
  }

  /**
   * Completed pods are left out on the API server, so that neither the list
   * nor the watch carries them. A pod that completes while watched arrives
   * as a DELETED event and leaves the store.
   */
  override get query(): KubeApiQueryParams {
    const query = super.query;

    if (!this.dependencies.hideCompletedPods?.()) {
      return query;
    }

    return { ...query, fieldSelector: "status.phase!=Succeeded" };
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
   *
   * With a namespace only the metrics of that namespace are replaced and the
   * others are kept. Without one the metrics of every pod are replaced; a user
   * who may not list them cluster-wide gets those of the selected namespaces.
   */
  async loadKubeMetrics(namespace?: string) {
    if (this.dependencies.isMetricsApiAvailable?.get() === false || !this.kubeMetricsBackoff.canAttempt()) {
      return;
    }

    try {
      if (namespace) {
        this.mergeKubeMetrics([namespace], (await this.dependencies.podMetricsApi.list({ namespace })) ?? []);
      } else {
        const namespaces = [...this.dependencies.context.contextNamespaces];
        // With every namespace selected, the selected ones are the whole cluster: one request, refused or not.
        const allSelected = this.dependencies.context.isLoadingAll(namespaces);

        if (this.clusterMetricsForbidden && !allSelected) {
          await this.loadKubeMetricsOfSelectedNamespaces(this.clusterMetricsForbidden);
        } else {
          try {
            this.kubeMetrics.replace((await this.dependencies.podMetricsApi.list({ namespace })) ?? []);
          } catch (error) {
            if (!isForbidden(error) || allSelected) {
              throw error;
            }

            // Refused for good: the next polls ask the selected namespaces only.
            this.clusterMetricsForbidden = error;
            await this.loadKubeMetricsOfSelectedNamespaces(error);
          }
        }
      }

      this.kubeMetricsBackoff.succeeded();
    } catch (error) {
      this.kubeMetricsBackoff.failed();
      console.warn("loadKubeMetrics failed", error);
    }
  }

  /** The refusal of the cluster-wide pod metrics, once the API server gave it. */
  private clusterMetricsForbidden: unknown = undefined;

  private async loadKubeMetricsOfSelectedNamespaces(forbidden: unknown) {
    const namespaces = [...this.dependencies.context.contextNamespaces];

    if (namespaces.length === 0) {
      throw forbidden;
    }

    const results = await Promise.allSettled(
      namespaces.map((namespace) => this.dependencies.podMetricsApi.list({ namespace })),
    );
    const loaded = namespaces.filter((_, index) => results[index].status === "fulfilled");

    if (loaded.length === 0) {
      throw forbidden;
    }

    this.mergeKubeMetrics(
      loaded,
      results.flatMap((result) => (result.status === "fulfilled" ? (result.value ?? []) : [])),
    );
  }

  /** Replaces the metrics of the namespaces and keeps those of the others. */
  private mergeKubeMetrics(namespaces: string[], metrics: PodMetrics[]) {
    const replaced = new Set(namespaces);

    this.kubeMetrics.replace([...this.kubeMetrics.filter((metric) => !replaced.has(metric.getNs())), ...metrics]);
  }

  // Reverse indexes over the pod list, so that the per-workload lookups
  // below stay O(1) instead of scanning every pod on every call. They are
  // rebuilt by MobX only when the items change. The lookups return copies:
  // handing out the cached arrays would let a caller that sorts or splices
  // its result corrupt the index for everyone else.
  @computed private get podsByOwnerId(): Map<string, Pod[]> {
    const map = new Map<string, Pod[]>();

    for (const pod of this.items.slice()) {
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

    for (const pod of this.items.slice()) {
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

  @computed private get podsByNamespace(): Map<string, Pod[]> {
    const map = new Map<string, Pod[]>();

    for (const pod of this.items.slice()) {
      const namespace = pod.getNs();
      const pods = map.get(namespace);

      if (pods) {
        pods.push(pod);
      } else {
        map.set(namespace, [pod]);
      }
    }

    return map;
  }

  @computed private get podsByPvc(): Map<string, Pod[]> {
    const map = new Map<string, Pod[]>();

    for (const pod of this.items.slice()) {
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

  getPodsByNode(node: string): Pod[] {
    if (!this.isLoaded) return [];

    return [...(this.podsByNode.get(node) ?? [])];
  }

  getPodsByPvc(namespace: string, claimName: string): Pod[] {
    return [...(this.podsByPvc.get(`${namespace}/${claimName}`) ?? [])];
  }

  getPodsByNamespace(namespace: string): Pod[] {
    return [...(this.podsByNamespace.get(namespace) ?? [])];
  }

  // The pods `persistentVolumeClaim.getPods(podStore.items)` returns.
  getPodsByPersistentVolumeClaim(persistentVolumeClaim: PersistentVolumeClaim): Pod[] {
    return this.getPodsByPvc(persistentVolumeClaim.getNs(), persistentVolumeClaim.getName());
  }

  getStatuses(pods: Pod[]) {
    const counts = new Map<string, number>();

    for (const pod of pods) {
      const status = pod.getStatus();

      counts.set(status, (counts.get(status) ?? 0) + 1);
    }

    // The key order of the result is the order of the pie chart segments:
    // descending by status name. Only the distinct statuses are sorted.
    const result: Record<string, number> = {};

    for (const status of [...counts.keys()].sort().reverse()) {
      result[status] = counts.get(status) as number;
    }

    return result;
  }

  // A pod object and a metrics object are never changed after they are made (a
  // watch event or a metrics list makes new ones), so the usage of a pod is
  // worked out once for the pair, and goes with the pod. Lists and sorts ask
  // for it per pod on every pass.
  private readonly kubeMetricsOfPod = new WeakMap<
    Pod,
    { metrics: PodMetrics; usage: { cpu: number; memory: number } }
  >();

  getPodKubeMetrics(pod: Pod) {
    const metrics = this.kubeMetricsByPod.get(`${pod.getNs()}/${pod.getName()}`);

    if (!metrics || !metrics.containers) return { cpu: NaN, memory: NaN };

    const cached = this.kubeMetricsOfPod.get(pod);

    if (cached?.metrics === metrics) {
      // A copy, as every call returned a new object.
      return { ...cached.usage };
    }

    const usage = this.computePodKubeMetrics(pod, metrics);

    this.kubeMetricsOfPod.set(pod, { metrics, usage });

    return { ...usage };
  }

  private computePodKubeMetrics(pod: Pod, metrics: PodMetrics) {
    const containers = pod.getContainers();
    const empty = { cpu: 0, memory: 0 };

    if (!containers) return { cpu: NaN, memory: NaN };

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
