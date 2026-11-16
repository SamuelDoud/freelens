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
  readonly pods: Pod[];
  readonly byLabel: Map<string, Pod[]>;
}

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

    // Pods indexed once per call (built on the first deployment, so an empty
    // list reads no pods): by namespace, then by "key=value" label. A deployment
    // tests only the pods that carry its rarest template label instead of every
    // pod of its namespace. Buckets keep store order.
    let index: Map<string, NamespaceIndex> | undefined;
    const labelSets = new Map<Pod, Set<string>>();

    const labelsOf = (pod: Pod) => {
      let labels = labelSets.get(pod);

      if (!labels) {
        labels = new Set(pod.getLabels());
        labelSets.set(pod, labels);
      }

      return labels;
    };

    for (const deployment of deployments) {
      index ??= this.indexPods();

      const templateLabels = deployment.getTemplateLabels();
      const namespaceIndex = index.get(deployment.getNs());
      let candidates = namespaceIndex?.pods ?? [];

      for (const label of templateLabels) {
        const withLabel = namespaceIndex?.byLabel.get(label) ?? [];

        if (withLabel.length < candidates.length) {
          candidates = withLabel;
        }
      }

      let failed = false;
      let pending = false;

      for (const pod of candidates) {
        if (!templateLabels.every((label) => labelsOf(pod).has(label))) {
          continue;
        }

        const phase = pod.getStatus();

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

  private indexPods() {
    const index = new Map<string, NamespaceIndex>();

    for (const pod of this.dependencies.podStore.items) {
      const namespace = pod.getNs();
      let namespaceIndex = index.get(namespace);

      if (!namespaceIndex) {
        namespaceIndex = { pods: [], byLabel: new Map() };
        index.set(namespace, namespaceIndex);
      }

      namespaceIndex.pods.push(pod);

      for (const label of pod.getLabels()) {
        const withLabel = namespaceIndex.byLabel.get(label);

        if (withLabel) {
          // The same string twice in one pod (keys and values containing "=") is one entry.
          if (withLabel[withLabel.length - 1] !== pod) {
            withLabel.push(pod);
          }
        } else {
          namespaceIndex.byLabel.set(label, [pod]);
        }
      }
    }

    return index;
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
