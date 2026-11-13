/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "@testing-library/jest-dom/vitest";

import { Node, Pod } from "@freelensapp/kube-object";
import { act } from "@testing-library/react";
import { observable, runInAction } from "mobx";
import { Observer } from "mobx-react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import directoryForKubeConfigsInjectable from "../../../common/app-paths/directory-for-kube-configs/directory-for-kube-configs.injectable";
import directoryForUserDataInjectable from "../../../common/app-paths/directory-for-user-data/directory-for-user-data.injectable";
import { Cluster } from "../../../common/cluster/cluster";
import directoryForLensLocalStorageInjectable from "../../../common/directory-for-lens-local-storage/directory-for-lens-local-storage.injectable";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import { getDiForUnitTesting } from "../../getDiForUnitTesting";
import storesAndApisCanBeCreatedInjectable from "../../stores-apis-can-be-created.injectable";
import { renderFor } from "../test-utils/renderFor";
import podStoreInjectable from "../workloads-pods/store.injectable";
import { NodesRoute } from "./route";

import type { DiRender } from "../test-utils/renderFor";

// The list layout is replaced by a table of the node rows. Like the real one it
// renders each row in its own observer and runs the sorting callbacks over all
// nodes, so the cells and the sort read the pods the way they do in the app.
vi.mock("../kube-object-list-layout", () => ({
  KubeObjectListLayout: ({
    store,
    renderTableContents,
    sortingCallbacks,
  }: {
    store: { items: Node[] };
    renderTableContents: (node: Node) => unknown[];
    sortingCallbacks: Record<string, (node: Node) => unknown>;
  }) => (
    <div>
      <Observer>
        {() => (
          <ul data-testid="sorted">
            {store.items.map((node) => `${node.getName()}:${String(sortingCallbacks.pods(node))}`).join(",")}
          </ul>
        )}
      </Observer>
      {store.items.map((node) => (
        <Observer key={node.getName()}>
          {() => <div data-testid={`row-${node.getName()}`}>{renderTableContents(node).length}</div>}
        </Observer>
      ))}
    </div>
  ),
}));

const makeNode = (name: string, podCapacity: string) =>
  new Node({
    apiVersion: "v1",
    kind: "Node",
    metadata: { name, resourceVersion: "1", uid: name, selfLink: `/api/v1/nodes/${name}` },
    spec: { taints: [] },
    status: { allocatable: { pods: podCapacity, cpu: "8" }, capacity: { pods: podCapacity }, conditions: [] },
  } as unknown as ConstructorParameters<typeof Node>[0]);

const makePod = (name: string, nodeName: string | undefined, phase: string, cpu = "1") =>
  new Pod({
    apiVersion: "v1",
    kind: "Pod",
    metadata: { name, namespace: "default", resourceVersion: "1", uid: name, selfLink: `/api/v1/pods/${name}` },
    spec: { nodeName, containers: [{ name: "c", image: "i", resources: { requests: { cpu, memory: "1Gi" } } }] },
    status: { phase },
  } as unknown as ConstructorParameters<typeof Pod>[0]);

describe("<NodesRoute /> pods per node", () => {
  let render: DiRender;
  let podStore: ReturnType<typeof getPodStore>;
  const getPodStore = (di: ReturnType<typeof getDiForUnitTesting>) => di.inject(podStoreInjectable);
  const nodes = [makeNode("n1", "10"), makeNode("n2", "10"), makeNode("n3", "10")];

  const pods = () => [
    makePod("a", "n1", "Running"),
    makePod("b", "n1", "Succeeded"),
    makePod("c", "n2", "Running"),
    makePod("d", "n1", "Pending"),
    makePod("e", undefined, "Running"),
    makePod("f", "n2", "Failed"),
    makePod("g", "n2", "Running"),
  ];

  beforeEach(async () => {
    const di = getDiForUnitTesting();
    const { default: nodeStoreInjectable } = await import("./store.injectable");
    const { default: eventStoreInjectable } = await import("../events/store.injectable");
    const { default: requestAllNodeMetricsInjectable } = await import(
      "../../../common/k8s-api/endpoints/metrics.api/request-metrics-for-all-nodes.injectable"
    );
    const { default: subscribeStoresInjectable } = await import("../../kube-watch-api/subscribe-stores.injectable");
    const { default: loadPodsInjectable } = await import("../workloads-pods/load-pods-from-all-namespaces.injectable");

    di.override(directoryForLensLocalStorageInjectable, () => "some-directory");
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
    di.override(requestAllNodeMetricsInjectable, () => async () => ({}) as never);
    di.override(subscribeStoresInjectable, () => () => () => {});
    di.override(loadPodsInjectable, () => () => {});
    di.override(eventStoreInjectable, () => ({}) as never);
    di.override(
      nodeStoreInjectable,
      () =>
        ({
          items: nodes,
          loadKubeMetrics: async () => {},
          getNodeKubeMetrics: () => ({ cpu: NaN, memory: NaN }),
        }) as never,
    );

    podStore = getPodStore(di);
    runInAction(() => {
      podStore.items = observable.array(pods());
      (podStore as any).isLoaded = true;
    });
    render = renderFor(di);
  });

  it("lists the non-terminated pods of each node in store order and counts them for the sort", () => {
    const result = render(<NodesRoute />);

    expect(result.getByTestId("sorted").textContent).toBe("n1:2,n2:2,n3:0");
  });

  it("builds the pods per node once per render pass", () => {
    const spies = podStore.items.map((pod) => vi.spyOn(pod, "getStatusPhase"));

    render(<NodesRoute />);

    // 7 pods: one pass serves the sort and all three cells of every row.
    expect(spies.reduce((sum, spy) => sum + spy.mock.calls.length, 0)).toBe(7);
  });

  it("follows changes of the pods", () => {
    const result = render(<NodesRoute />);

    act(() => {
      runInAction(() => {
        podStore.items.replace([...podStore.items.slice(1), makePod("h", "n3", "Running")]);
      });
    });

    expect(result.getByTestId("sorted").textContent).toBe("n1:1,n2:2,n3:1");
  });
});
