/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { cpuUnitsToNumber, unitsToBytes } from "@freelensapp/utilities";
import autoBind from "auto-bind";
import { sum } from "es-toolkit";
import { computed, observable } from "mobx";
import { KubeObjectStore } from "../../../common/k8s-api/kube-object.store";
import { RetryBackoff } from "../../utils/retry-backoff";

import type { NodeApi, NodeMetricsApi } from "@freelensapp/kube-api";
import type { Node, NodeMetrics } from "@freelensapp/kube-object";

import type { IComputedValue } from "mobx";

import type { KubeObjectStoreDependencies, KubeObjectStoreOptions } from "../../../common/k8s-api/kube-object.store";

export interface NodeStoreDependencies extends KubeObjectStoreDependencies {
  readonly nodeMetricsApi: NodeMetricsApi;
  /**
   * Whether the cluster serves node metrics (metrics.k8s.io, from
   * metrics-server). Without it the metrics are not requested at all.
   */
  readonly isMetricsApiAvailable?: IComputedValue<boolean>;
}

export class NodeStore extends KubeObjectStore<Node, NodeApi> {
  constructor(
    protected readonly dependencies: NodeStoreDependencies,
    api: NodeApi,
    opts?: KubeObjectStoreOptions,
  ) {
    super(dependencies, api, opts);

    autoBind(this);
  }

  readonly kubeMetrics = observable.array<NodeMetrics>([]);

  @computed get kubeMetricsByNode(): Map<string, NodeMetrics> {
    const map = new Map<string, NodeMetrics>();

    for (const metric of this.kubeMetrics) {
      map.set(metric.getName(), metric);
    }

    return map;
  }

  private kubeMetricsLoading: Promise<void> | undefined;
  private readonly kubeMetricsBackoff = new RetryBackoff();

  loadKubeMetrics(): Promise<void> {
    // Not requested on a cluster that does not serve the metrics, and less
    // and less often while the request keeps failing.
    if (this.dependencies.isMetricsApiAvailable?.get() === false || !this.kubeMetricsBackoff.canAttempt()) {
      return this.kubeMetricsLoading ?? Promise.resolve();
    }

    // The metrics are polled on an interval; share one request between
    // overlapping calls instead of piling up identical lists.
    this.kubeMetricsLoading ??= (async () => {
      try {
        const metrics = await this.dependencies.nodeMetricsApi.list();

        this.kubeMetrics.replace(metrics ?? []);
        this.kubeMetricsBackoff.succeeded();
      } catch (error) {
        this.kubeMetricsBackoff.failed();
        console.warn("loadKubeMetrics failed", error);
      } finally {
        this.kubeMetricsLoading = undefined;
      }
    })();

    return this.kubeMetricsLoading;
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
    const metrics = this.kubeMetricsByNode.get(node.getName());

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
