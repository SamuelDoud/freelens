/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Deployment, Pod, PodStatusPhase } from "@freelensapp/kube-object";
import { observable } from "mobx";
import { beforeEach, describe, expect, it } from "vitest";
import directoryForKubeConfigsInjectable from "../../../common/app-paths/directory-for-kube-configs/directory-for-kube-configs.injectable";
import directoryForUserDataInjectable from "../../../common/app-paths/directory-for-user-data/directory-for-user-data.injectable";
import { Cluster } from "../../../common/cluster/cluster";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import { getDiForUnitTesting } from "../../getDiForUnitTesting";
import storesAndApisCanBeCreatedInjectable from "../../stores-apis-can-be-created.injectable";
import podStoreInjectable from "../workloads-pods/store.injectable";
import deploymentStoreInjectable from "./store.injectable";

import type { PodStore } from "../workloads-pods/store";
import type { DeploymentStore } from "./store";

const makeDeployment = (name: string, namespace: string, labels: Record<string, string> | undefined) =>
  new Deployment({
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: {
      name,
      namespace,
      resourceVersion: "1",
      uid: `${namespace}-${name}`,
      selfLink: `/apis/apps/v1/namespaces/${namespace}/deployments/${name}`,
    },
    spec: {
      replicas: 1,
      selector: { matchLabels: {} },
      strategy: { type: "RollingUpdate" },
      template: { metadata: { labels }, spec: { containers: [] } },
    },
  } as unknown as ConstructorParameters<typeof Deployment>[0]);

const makePod = (name: string, namespace: string, labels: Record<string, string> | undefined, phase: string) =>
  new Pod({
    apiVersion: "v1",
    kind: "Pod",
    metadata: {
      name,
      namespace,
      labels,
      resourceVersion: "1",
      uid: `${namespace}-${name}`,
      selfLink: `/api/v1/namespaces/${namespace}/pods/${name}`,
    },
    status: {
      phase,
      conditions: ["Initialized", "Ready"].map((type) => ({
        type,
        status: phase === "Running" ? "True" : "False",
        lastProbeTime: 1,
        lastTransitionTime: "1",
      })),
    },
  } as unknown as ConstructorParameters<typeof Pod>[0]);

describe("DeploymentStore child pods", () => {
  let podStore: PodStore;
  let deploymentStore: DeploymentStore;

  // The statuses the way they were computed before getStatuses indexed the
  // pods by namespace: every pod tested through getChildPods.
  const referenceStatuses = (deployments: Deployment[]) => {
    const status = { running: 0, failed: 0, pending: 0 };

    for (const deployment of deployments) {
      const statuses = new Set(deploymentStore.getChildPods(deployment).map((pod) => pod.getStatus()));

      if (statuses.has(PodStatusPhase.FAILED)) {
        status.failed++;
      } else if (statuses.has(PodStatusPhase.PENDING)) {
        status.pending++;
      } else {
        status.running++;
      }
    }

    return status;
  };

  beforeEach(() => {
    const di = getDiForUnitTesting();

    di.override(directoryForUserDataInjectable, () => "/some-user-store-path");
    di.override(directoryForKubeConfigsInjectable, () => "/some-kube-configs");
    di.override(storesAndApisCanBeCreatedInjectable, () => true);
    di.override(
      hostedClusterInjectable,
      () =>
        new Cluster({
          contextName: "some-context-name",
          id: "some-cluster-id",
          kubeConfigPath: "/some-path-to-a-kubeconfig",
        }),
    );

    podStore = di.inject(podStoreInjectable);
    deploymentStore = di.inject(deploymentStoreInjectable);
  });

  const pods = [
    makePod("a1", "one", { app: "a", tier: "web" }, "Running"),
    makePod("a2", "two", { app: "a", tier: "web" }, "Failed"),
    makePod("b1", "one", { app: "b" }, "Pending"),
    makePod("a3", "one", { app: "a", tier: "web", extra: "x" }, "Running"),
    makePod("a4", "one", { app: "a" }, "Failed"),
    makePod("bare", "one", undefined, "Running"),
    makePod("a5", "one", { app: "a", tier: "web" }, "Running"),
  ];

  it("returns the pods of the namespace that carry all template labels, in store order", () => {
    podStore.items = observable.array(pods);

    const deployment = makeDeployment("a", "one", { app: "a", tier: "web" });

    expect(deploymentStore.getChildPods(deployment).map((pod) => pod.getName())).toEqual(["a1", "a3", "a5"]);
  });

  it("gives the statuses getChildPods implies, including empty labels and unknown namespaces", () => {
    podStore.items = observable.array(pods);

    const deployments = [
      makeDeployment("web", "one", { app: "a", tier: "web" }), // running pods only
      makeDeployment("web", "two", { app: "a", tier: "web" }), // failed pod from the other namespace
      makeDeployment("pending", "one", { app: "b" }), // pending
      makeDeployment("failed", "one", { app: "a" }), // failed wins over running
      makeDeployment("anything", "one", {}), // empty labels match every pod of the namespace
      makeDeployment("nolabels", "one", undefined),
      makeDeployment("nothing", "one", { app: "zzz" }), // no pods counts as running
      makeDeployment("elsewhere", "three", { app: "a" }), // namespace without pods
    ];

    expect(deploymentStore.getStatuses(deployments)).toEqual(referenceStatuses(deployments));
    expect(deploymentStore.getStatuses(deployments)).toEqual({ running: 3, failed: 4, pending: 1 });
  });

  it("returns zero counts for no deployments", () => {
    podStore.items = observable.array(pods);

    expect(deploymentStore.getStatuses([])).toEqual({ running: 0, failed: 0, pending: 0 });
    expect(deploymentStore.getStatuses(undefined)).toEqual({ running: 0, failed: 0, pending: 0 });
  });

  it("counts a label value that only differs by the separator as a different label", () => {
    podStore.items = observable.array([makePod("p", "one", { "a=b": "c" }, "Failed")]);

    const deployments = [makeDeployment("d", "one", { a: "b=c" })];

    expect(deploymentStore.getStatuses(deployments)).toEqual(referenceStatuses(deployments));
  });
});
