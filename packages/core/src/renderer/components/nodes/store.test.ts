/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Node, NodeMetrics } from "@freelensapp/kube-object";
import { beforeEach, describe, expect, it, vi } from "vitest";
import directoryForKubeConfigsInjectable from "../../../common/app-paths/directory-for-kube-configs/directory-for-kube-configs.injectable";
import directoryForUserDataInjectable from "../../../common/app-paths/directory-for-user-data/directory-for-user-data.injectable";
import { Cluster } from "../../../common/cluster/cluster";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import { getDiForUnitTesting } from "../../getDiForUnitTesting";
import storesAndApisCanBeCreatedInjectable from "../../stores-apis-can-be-created.injectable";
import nodeStoreInjectable from "./store.injectable";

import type { Mock } from "vitest";

import type { NodeStore, NodeStoreDependencies } from "./store";

const nodeNamed = (name: string) =>
  new Node({
    apiVersion: "v1",
    kind: "Node",
    metadata: {
      name,
      resourceVersion: "1",
      uid: name,
      selfLink: `/api/v1/nodes/${name}`,
    },
  } as ConstructorParameters<typeof Node>[0]);

const metricsFor = (name: string, cpu: string, memory: string) =>
  new NodeMetrics({
    apiVersion: "metrics.k8s.io/v1beta1",
    kind: "NodeMetrics",
    metadata: {
      name,
      resourceVersion: "1",
      uid: name,
      selfLink: `/apis/metrics.k8s.io/v1beta1/nodes/${name}`,
    },
    usage: { cpu, memory },
  } as ConstructorParameters<typeof NodeMetrics>[0]);

describe("NodeStore kube metrics", () => {
  let nodeStore: NodeStore;
  let listMetrics: Mock<NodeStoreDependencies["nodeMetricsApi"]["list"]>;

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

    nodeStore = di.inject(nodeStoreInjectable);

    listMetrics = vi.fn(async () => [metricsFor("some-node", "1", "1Gi"), metricsFor("other-node", "2", "2Gi")]);
    nodeStore["dependencies"].nodeMetricsApi.list = listMetrics;
  });

  it("gets the metrics of a node by name", async () => {
    await nodeStore.loadKubeMetrics();

    expect(nodeStore.getNodeKubeMetrics(nodeNamed("some-node"))).toEqual({ cpu: 1, memory: 1024 ** 3 });
    expect(nodeStore.getNodeKubeMetrics(nodeNamed("other-node"))).toEqual({ cpu: 2, memory: 2 * 1024 ** 3 });
    expect(nodeStore.getNodeKubeMetrics(nodeNamed("no-such-node"))).toEqual({ cpu: NaN, memory: NaN });
  });

  it("shares one request between overlapping loads", async () => {
    let release!: () => void;

    listMetrics.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve([metricsFor("some-node", "1", "1Gi")]);
        }),
    );

    const first = nodeStore.loadKubeMetrics();
    const second = nodeStore.loadKubeMetrics();

    expect(listMetrics).toHaveBeenCalledTimes(1);

    release();
    await Promise.all([first, second]);

    expect(nodeStore.getNodeKubeMetrics(nodeNamed("some-node"))).toEqual({ cpu: 1, memory: 1024 ** 3 });

    listMetrics.mockResolvedValue([metricsFor("some-node", "1", "1Gi")]);

    await nodeStore.loadKubeMetrics();

    expect(listMetrics).toHaveBeenCalledTimes(2);
  });
});
