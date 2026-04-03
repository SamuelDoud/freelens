/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { cpuUnitsToNumber, unitsToBytes } from "@freelensapp/utilities";
import autoBind from "auto-bind";
import { sum } from "lodash";
import { computed, makeObservable, observable } from "mobx";
import { KubeObjectStore } from "../../../common/k8s-api/kube-object.store";

import type { NodeApi, NodeMetricsApi } from "@freelensapp/kube-api";
import type { Node, NodeMetrics } from "@freelensapp/kube-object";

import type { KubeObjectStoreDependencies, KubeObjectStoreOptions } from "../../../common/k8s-api/kube-object.store";

export interface NodeStoreDependencies extends KubeObjectStoreDependencies {
  readonly nodeMetricsApi: NodeMetricsApi;
}

export class NodeStore extends KubeObjectStore<Node, NodeApi> {
  constructor(
    protected readonly dependencies: NodeStoreDependencies,
    api: NodeApi,
    opts?: KubeObjectStoreOptions,
  ) {
    super(dependencies, api, opts);

    makeObservable(this);
    autoBind(this);
  }

  readonly kubeMetrics = observable.array<NodeMetrics>([], { deep: false });
  private metricsLoadInFlight = false;

  @computed private get kubeMetricsIndex(): Map<string, NodeMetrics> {
    const map = new Map<string, NodeMetrics>();

    for (const metric of this.kubeMetrics) {
      map.set(metric.getName(), metric);
    }

    return map;
  }

  async loadKubeMetrics() {
    if (this.metricsLoadInFlight) return;
    this.metricsLoadInFlight = true;

    try {
      const metrics = await this.dependencies.nodeMetricsApi.list();

      this.kubeMetrics.replace(metrics ?? []);
    } catch (error) {
      console.warn("loadKubeMetrics failed", error);
    } finally {
      this.metricsLoadInFlight = false;
    }
  }

  @computed get masterNodes() {
    return this.items.filter((node) => node.isMasterNode());
  }

  @computed get workerNodes() {
    return this.items.filter((node) => !node.isMasterNode());
  }

  getWarningsCount(): number {
    return sum(this.items.map((node) => node.getWarningConditions().length));
  }

  getNodeKubeMetrics(node: Node) {
    const metrics = this.kubeMetricsIndex.get(node.getName());

    if (!metrics) return { cpu: NaN, memory: NaN };

    if (metrics && metrics.usage) {
      return {
        cpu: Number(cpuUnitsToNumber(metrics.usage.cpu)) || 0,
        memory: Number(unitsToBytes(metrics.usage.memory)) || 0,
      };
    }

    return {
      cpu: 0,
      memory: 0,
    };
  }
}
