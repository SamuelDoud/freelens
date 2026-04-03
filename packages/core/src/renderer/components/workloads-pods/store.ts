/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { cpuUnitsToNumber, unitsToBytes } from "@freelensapp/utilities";
import countBy from "lodash/countBy";
import { computed, observable } from "mobx";
import { buildOwnerIndex, KubeObjectStore } from "../../../common/k8s-api/kube-object.store";
import { PERF_DEBUG } from "../../../common/utils/perf-debug";

import type { PodApi, PodMetricsApi } from "@freelensapp/kube-api";
import type { KubeObject, NamespaceScopedMetadata, Pod, PodMetrics } from "@freelensapp/kube-object";

import type { KubeObjectStoreDependencies, KubeObjectStoreOptions } from "../../../common/k8s-api/kube-object.store";

export interface PodStoreDependencies extends KubeObjectStoreDependencies {
  readonly podMetricsApi: PodMetricsApi;
}

export class PodStore extends KubeObjectStore<Pod, PodApi> {
  constructor(
    protected readonly dependencies: PodStoreDependencies,
    api: PodApi,
    opts?: KubeObjectStoreOptions,
  ) {
    super(dependencies, api, opts);
  }

  readonly kubeMetrics = observable.array<PodMetrics>([], { deep: false });
  private metricsLoadInFlight = false;

  @computed private get kubeMetricsIndex(): Map<string, PodMetrics> {
    const start = PERF_DEBUG ? performance.now() : 0;
    const map = new Map<string, PodMetrics>();

    for (const metric of this.kubeMetrics) {
      map.set(`${metric.getNs()}/${metric.getName()}`, metric);
    }

    if (PERF_DEBUG)
      console.debug(
        `[PERF] kubeMetricsIndex: ${map.size} metrics indexed in ${(performance.now() - start).toFixed(1)}ms`,
      );

    return map;
  }

  @computed private get podsByOwnerId(): Map<string, Pod[]> {
    return buildOwnerIndex(this.items);
  }

  async loadKubeMetrics(namespace?: string) {
    if (this.metricsLoadInFlight) return;
    this.metricsLoadInFlight = true;
    const start = PERF_DEBUG ? performance.now() : 0;

    try {
      // Scope to context namespaces instead of fetching all namespaces
      const namespaces = namespace ? [namespace] : this.dependencies.context.contextNamespaces;

      const results = await Promise.allSettled(
        namespaces.map((ns) => this.dependencies.podMetricsApi.list({ namespace: ns })),
      );
      const allMetrics: PodMetrics[] = [];

      for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
          allMetrics.push(...result.value);
        }
      }

      this.kubeMetrics.replace(allMetrics);
      if (PERF_DEBUG)
        console.debug(
          `[PERF] loadKubeMetrics: ${allMetrics.length} metrics from ${namespaces.length} namespaces in ${(performance.now() - start).toFixed(0)}ms`,
        );
    } catch (error) {
      console.warn("loadKubeMetrics failed", error);
    } finally {
      this.metricsLoadInFlight = false;
    }
  }

  getPodsByOwner(workload: KubeObject<NamespaceScopedMetadata, unknown, unknown>): Pod[] {
    return this.podsByOwnerId.get(workload.getId()) ?? [];
  }

  getPodsByOwnerId(workloadId: string): Pod[] {
    return this.podsByOwnerId.get(workloadId) ?? [];
  }

  @computed private get podsByNodeIndex(): Map<string, Pod[]> {
    const map = new Map<string, Pod[]>();

    for (const pod of this.items) {
      const nodeName = pod.spec?.nodeName;

      if (nodeName) {
        let list = map.get(nodeName);

        if (!list) {
          list = [];
          map.set(nodeName, list);
        }

        list.push(pod);
      }
    }

    return map;
  }

  getPodsByNode(node: string) {
    if (!this.isLoaded) return [];

    return this.podsByNodeIndex.get(node) ?? [];
  }

  /**
   * Index of pods by PVC claim name (key: "namespace/claimName").
   * Used by PersistentVolumeClaim to avoid O(pods × volumes) scans.
   */
  @computed get podsByPvcIndex(): Map<string, Pod[]> {
    const map = new Map<string, Pod[]>();

    for (const pod of this.items) {
      const ns = pod.getNs();

      for (const volume of pod.getVolumes()) {
        const claimName = volume.persistentVolumeClaim?.claimName;

        if (claimName) {
          const key = `${ns}/${claimName}`;
          let list = map.get(key);

          if (!list) {
            list = [];
            map.set(key, list);
          }

          list.push(pod);
        }
      }
    }

    return map;
  }

  getPodsByPvc(namespace: string, claimName: string): Pod[] {
    return this.podsByPvcIndex.get(`${namespace}/${claimName}`) ?? [];
  }

  getStatuses(pods: Pod[]) {
    return countBy(pods.map((pod) => pod.getStatus()));
  }

  getPodKubeMetrics(pod: Pod) {
    const containers = pod.getContainers();
    const empty = { cpu: 0, memory: 0 };
    const metrics = this.kubeMetricsIndex.get(`${pod.getNs()}/${pod.getName()}`);

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
