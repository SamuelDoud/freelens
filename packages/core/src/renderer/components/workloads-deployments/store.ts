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

    // Pods grouped by namespace once per call, built on the first deployment
    // (an empty list reads no pods, as before), so that each deployment tests
    // only the pods of its own namespace instead of every pod in the cluster.
    // Each group keeps store order, like getChildPods.
    let podsByNamespace: Map<string, Pod[]> | undefined;

    deployments.forEach((deployment) => {
      if (!podsByNamespace) {
        podsByNamespace = new Map();

        for (const pod of this.dependencies.podStore.items) {
          const namespace = pod.getNs();
          const pods = podsByNamespace.get(namespace);

          if (pods) {
            pods.push(pod);
          } else {
            podsByNamespace.set(namespace, [pod]);
          }
        }
      }

      const templateLabels = deployment.getTemplateLabels();
      const childPods = (podsByNamespace.get(deployment.getNs()) ?? []).filter((pod) => {
        const podLabels = pod.getLabels();

        return templateLabels.every((label) => podLabels.includes(label));
      });
      const statuses = new Set(childPods.map((pod) => pod.getStatus()));

      if (statuses.has(PodStatusPhase.FAILED)) {
        status.failed++;
      } else if (statuses.has(PodStatusPhase.PENDING)) {
        status.pending++;
      } else {
        status.running++;
      }
    });

    return status;
  }

  getChildPods(deployment: Deployment) {
    return this.dependencies.podStore
      .getByLabel(deployment.getTemplateLabels())
      .filter((pod) => pod.getNs() === deployment.getNs());
  }
}
