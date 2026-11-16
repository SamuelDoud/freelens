/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { PodStatusPhase } from "@freelensapp/kube-object";
import { KubeObjectStore } from "../../../common/k8s-api/kube-object.store";

import type { DeploymentApi } from "@freelensapp/kube-api";
import type { Deployment, Pod } from "@freelensapp/kube-object";

import type { ItemSorting } from "../../../common/item.store";
import type { KubeObjectStoreDependencies, KubeObjectStoreOptions } from "../../../common/k8s-api/kube-object.store";
import type { PodStore } from "../workloads-pods/store";

// This needs to be disables because of https://github.com/microsoft/TypeScript/issues/15300
export type DeploymentStatuses = {
  running: number;
  failed: number;
  pending: number;
};

interface NamespaceIndex {
  readonly pods: Set<Pod>;
  readonly byLabel: Map<string, Set<Pod>>;
}

const emptyPods: Set<Pod> = new Set();

export interface DeploymentStoreDependencies extends KubeObjectStoreDependencies {
  readonly podStore: PodStore;
}

export class DeploymentStore extends KubeObjectStore<Deployment, DeploymentApi> {
  constructor(
    protected readonly dependencies: DeploymentStoreDependencies,
    api: DeploymentApi,
    opts?: KubeObjectStoreOptions,
  ) {
    super(dependencies, api, opts);
  }

  protected readonly sorting: ItemSorting<Deployment> = {
    by: [(item) => item.getReplicas()],
    order: "desc",
  };

  getStatuses(deployments: Deployment[]): DeploymentStatuses;
  /**
   * @deprecated
   */
  getStatuses(deployments: Deployment[] | undefined): DeploymentStatuses;
  getStatuses(deployments: Deployment[] = []) {
    const status = { running: 0, failed: 0, pending: 0 };

    // Brought up to date on the first deployment, so an empty list reads no pods.
    let index: Map<string, NamespaceIndex> | undefined;

    for (const deployment of deployments) {
      index ??= this.syncedPodIndex();

      const templateLabels = deployment.getTemplateLabels();
      const namespaceIndex = index.get(deployment.getNs());
      let candidates: Set<Pod> = namespaceIndex?.pods ?? emptyPods;

      // A deployment tests only the pods that carry its rarest template label.
      for (const label of templateLabels) {
        const withLabel = namespaceIndex?.byLabel.get(label) ?? emptyPods;

        if (withLabel.size < candidates.size) {
          candidates = withLabel;
        }
      }

      let failed = false;
      let pending = false;

      for (const pod of candidates) {
        if (!templateLabels.every((label) => namespaceIndex?.byLabel.get(label)?.has(pod))) {
          continue;
        }

        const phase = this.getPodStatus(pod);

        if (phase === PodStatusPhase.FAILED) {
          failed = true;
          break;
        }

        if (phase === PodStatusPhase.PENDING) {
          pending = true;
        }
      }

      if (failed) {
        status.failed++;
      } else if (pending) {
        status.pending++;
      } else {
        status.running++;
      }
    }

    return status;
  }

  // The pods by namespace, then by "key=value" label, kept between calls. A
  // pod object is never changed after it is made (a watch event makes a new
  // one), so a call only adds the pods that appeared since the last one and
  // removes those that went, instead of reading every pod's labels again.
  // Only the existence of a failed or pending pod matters, never the order of
  // the pods, so the buckets are sets.
  private readonly podIndex = new Map<string, NamespaceIndex>();
  private readonly indexedPods = new Set<Pod>();
  private readonly podStatuses = new WeakMap<Pod, string>();

  private syncedPodIndex() {
    // A copy: iterating the observable array goes through its proxy, ten times slower.
    const items = this.dependencies.podStore.items.slice();

    // The usual call finds nothing new: one pass of lookups, no copy.
    if (items.length !== this.indexedPods.size || !items.every((pod) => this.indexedPods.has(pod))) {
      const present = new Set<Pod>(items);

      for (const pod of this.indexedPods) {
        if (!present.has(pod)) {
          this.indexedPods.delete(pod);
          this.removeFromIndex(pod);
        }
      }

      for (const pod of present) {
        if (!this.indexedPods.has(pod)) {
          this.indexedPods.add(pod);
          this.addToIndex(pod);
        }
      }
    }

    return this.podIndex;
  }

  private addToIndex(pod: Pod) {
    const namespace = pod.getNs();
    let namespaceIndex = this.podIndex.get(namespace);

    if (!namespaceIndex) {
      namespaceIndex = { pods: new Set(), byLabel: new Map() };
      this.podIndex.set(namespace, namespaceIndex);
    }

    namespaceIndex.pods.add(pod);

    for (const label of pod.getLabels()) {
      const withLabel = namespaceIndex.byLabel.get(label);

      if (withLabel) {
        // The same string twice in one pod (keys and values containing "=") is one entry.
        withLabel.add(pod);
      } else {
        namespaceIndex.byLabel.set(label, new Set([pod]));
      }
    }
  }

  private removeFromIndex(pod: Pod) {
    const namespaceIndex = this.podIndex.get(pod.getNs());

    if (!namespaceIndex) {
      return;
    }

    namespaceIndex.pods.delete(pod);

    for (const label of pod.getLabels()) {
      const withLabel = namespaceIndex.byLabel.get(label);

      if (withLabel?.delete(pod) && withLabel.size === 0) {
        namespaceIndex.byLabel.delete(label);
      }
    }

    if (namespaceIndex.pods.size === 0) {
      this.podIndex.delete(pod.getNs());
    }
  }

  private getPodStatus(pod: Pod) {
    let phase = this.podStatuses.get(pod);

    if (phase === undefined) {
      phase = pod.getStatus();
      this.podStatuses.set(pod, phase);
    }

    return phase;
  }

  getChildPods(deployment: Deployment) {
    const namespace = deployment.getNs();
    const templateLabels = deployment.getTemplateLabels();

    // Namespace first: it is a field read, while the labels are built per pod.
    return this.dependencies.podStore.items.filter((pod) => {
      if (pod.getNs() !== namespace) {
        return false;
      }

      const podLabels = pod.getLabels();

      return templateLabels.every((label) => podLabels.includes(label));
    });
  }
}
