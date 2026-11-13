/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Namespace, Pod } from "@freelensapp/kube-object";
import { beforeEach, describe, expect, it } from "vitest";
import directoryForKubeConfigsInjectable from "../../../../../common/app-paths/directory-for-kube-configs/directory-for-kube-configs.injectable";
import directoryForUserDataInjectable from "../../../../../common/app-paths/directory-for-user-data/directory-for-user-data.injectable";
import { Cluster } from "../../../../../common/cluster/cluster";
import navigateToPodsInjectable from "../../../../../common/front-end-routing/routes/cluster/workloads/pods/navigate-to-pods.injectable";
import hostedClusterInjectable from "../../../../cluster-frame-context/hosted-cluster.injectable";
import { getDiForUnitTesting } from "../../../../getDiForUnitTesting";
import storesAndApisCanBeCreatedInjectable from "../../../../stores-apis-can-be-created.injectable";
import namespaceStoreInjectable from "../../../namespaces/store.injectable";
import podStoreInjectable from "../../../workloads-pods/store.injectable";
import podsWorkloadInjectable from "./pods-workload.injectable";

import type { IComputedValue } from "mobx";

const podIn = (namespace: string) =>
  new Pod({
    apiVersion: "v1",
    kind: "Pod",
    metadata: {
      name: `pod-in-${namespace}`,
      resourceVersion: "1",
      uid: `pod-in-${namespace}`,
      namespace,
      selfLink: `/api/v1/pods/${namespace}/pod-in-${namespace}`,
    },
  } as ConstructorParameters<typeof Pod>[0]);

const namespaceNamed = (name: string) =>
  new Namespace({
    apiVersion: "v1",
    kind: "Namespace",
    metadata: {
      name,
      resourceVersion: "1",
      uid: name,
      selfLink: `/api/v1/namespaces/${name}`,
    },
  } as ConstructorParameters<typeof Namespace>[0]);

describe("pods workload overview", () => {
  let amountOfItems: IComputedValue<number>;

  beforeEach(() => {
    const di = getDiForUnitTesting();

    di.override(directoryForUserDataInjectable, () => "/some-user-store-path");
    di.override(directoryForKubeConfigsInjectable, () => "/some-kube-configs");
    di.override(storesAndApisCanBeCreatedInjectable, () => true);
    di.override(navigateToPodsInjectable, () => () => {});

    const cluster = new Cluster({
      contextName: "some-context-name",
      id: "some-cluster-id",
      kubeConfigPath: "/some-path-to-a-kubeconfig",
    });

    // The cluster is configured to only show the "default" namespace, as
    // with the accessibleNamespaces cluster setting.
    cluster.accessibleNamespaces.replace(["default"]);

    di.override(hostedClusterInjectable, () => cluster);

    const namespaceStore = di.inject(namespaceStoreInjectable);

    namespaceStore.items.replace([namespaceNamed("default"), namespaceNamed("kube-system")]);

    const podStore = di.inject(podStoreInjectable);

    podStore.items.replace([podIn("default"), podIn("kube-system")]);

    amountOfItems = di.inject(podsWorkloadInjectable).amountOfItems;
  });

  it("counts the same pods as the pod list shows for this cluster", () => {
    expect(amountOfItems.get()).toBe(1);
  });
});
