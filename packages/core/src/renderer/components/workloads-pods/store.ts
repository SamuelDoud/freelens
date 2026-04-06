/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { cpuUnitsToNumber, unitsToBytes } from "@freelensapp/utilities";
import countBy from "lodash/countBy";
import { observable } from "mobx";
import { KubeObjectStore } from "../../../common/k8s-api/kube-object.store";

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

  readonly kubeMetrics = observable.array<PodMetrics>([]);

  @computed private get podsByOwnerId(): Map<string, Pod[]> {
    const map = new Map<string, Pod[]>();

    for (const pod of this.items) {
      for (const ref of pod.metadata.ownerReferences ?? []) {
        let pods = map.get(ref.uid);

        if (!pods) {
          pods = [];
          map.set(ref.uid, pods);
        }

        pods.push(pod);
      }
    }

    return map;
  }

  async loadKubeMetrics(namespace?: string) {
    try {
      const metrics = await this.dependencies.podMetricsApi.list({ namespace });

      this.kubeMetrics.replace(metrics ?? []);
    } catch (error) {
      console.warn("loadKubeMetrics failed", error);
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
    const metrics = this.kubeMetrics?.find((metric) => {
      return [metric.getName() === pod.getName(), metric.getNs() === pod.getNs()].every((v) => v);
    });

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
