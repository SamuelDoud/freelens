/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Pod } from "@freelensapp/kube-object";
import { beforeEach, describe, expect, it } from "vitest";
import directoryForKubeConfigsInjectable from "../../../common/app-paths/directory-for-kube-configs/directory-for-kube-configs.injectable";
import directoryForUserDataInjectable from "../../../common/app-paths/directory-for-user-data/directory-for-user-data.injectable";
import { Cluster } from "../../../common/cluster/cluster";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import { getDiForUnitTesting } from "../../getDiForUnitTesting";
import storesAndApisCanBeCreatedInjectable from "../../stores-apis-can-be-created.injectable";
import podStoreInjectable from "../workloads-pods/store.injectable";

import type { PodStore } from "../workloads-pods/store";

const runningPod = new Pod({
  apiVersion: "foo",
  kind: "Pod",
  metadata: {
    name: "foobar",
    resourceVersion: "foobar",
    uid: "foobar",
    namespace: "default",
    selfLink: "/api/v1/pods/default/foobar",
  },
  status: {
    phase: "Running",
    conditions: [
      {
        type: "Initialized",
        status: "True",
        lastProbeTime: 1,
        lastTransitionTime: "1",
      },
      {
        type: "Ready",
        status: "True",
        lastProbeTime: 1,
        lastTransitionTime: "1",
      },
    ],
    hostIP: "10.0.0.1",
    podIP: "10.0.0.1",
    startTime: "now",
    containerStatuses: [],
    initContainerStatuses: [],
  },
});

const pendingPod = new Pod({
  apiVersion: "foo",
  kind: "Pod",
  metadata: {
    name: "foobar-pending",
    resourceVersion: "foobar",
    uid: "foobar-pending",
    namespace: "default",
    selfLink: "/api/v1/pods/default/foobar-pending",
  },
});

const failedPod = new Pod({
  apiVersion: "foo",
  kind: "Pod",
  metadata: {
    name: "foobar-failed",
    resourceVersion: "foobar",
    uid: "foobar-failed",
    namespace: "default",
    selfLink: "/api/v1/pods/default/foobar-failed",
  },
  status: {
    phase: "Failed",
    conditions: [],
    hostIP: "10.0.0.1",
    podIP: "10.0.0.1",
    startTime: "now",
  },
});

const evictedPod = new Pod({
  apiVersion: "foo",
  kind: "Pod",
  metadata: {
    name: "foobar-evicted",
    resourceVersion: "foobar",
    uid: "foobar-evicted",
    namespace: "default",
    selfLink: "/api/v1/pods/default/foobar-evicted",
  },
  status: {
    phase: "Failed",
    reason: "Evicted",
    conditions: [],
    hostIP: "10.0.0.1",
    podIP: "10.0.0.1",
    startTime: "now",
  },
});

const succeededPod = new Pod({
  apiVersion: "foo",
  kind: "Pod",
  metadata: {
    name: "foobar-succeeded",
    resourceVersion: "foobar",
    uid: "foobar-succeeded",
    namespace: "default",
    selfLink: "/api/v1/pods/default/foobar-succeeded",
  },
  status: {
    phase: "Succeeded",
    conditions: [],
    hostIP: "10.0.0.1",
    podIP: "10.0.0.1",
    startTime: "now",
  },
});

describe("Pod Store tests", () => {
  let podStore: PodStore;

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
  });

  it("gets Pod statuses in proper sorting order", () => {
    const statuses = Object.entries(
      podStore.getStatuses([pendingPod, runningPod, succeededPod, failedPod, evictedPod, evictedPod]),
    );

    expect(statuses).toEqual([
      ["Succeeded", 1],
      ["Running", 1],
      ["Pending", 1],
      ["Failed", 1],
      ["Evicted", 2],
    ]);
  });

  it("keeps the key order of the sorted statuses, ties and unknown statuses included", () => {
    const withReason = (reason: string) =>
      new Pod({
        apiVersion: "foo",
        kind: "Pod",
        metadata: { name: reason, resourceVersion: "1", uid: reason, namespace: "default", selfLink: reason },
        status: { phase: "Running", reason, conditions: [] },
      } as unknown as ConstructorParameters<typeof Pod>[0]);
    const pods = [
      runningPod,
      withReason("Zeta"),
      succeededPod,
      withReason("alpha"),
      runningPod,
      withReason("Zeta"),
      failedPod,
      pendingPod,
      withReason("alpha"),
      succeededPod,
    ];
    const statuses = pods.map((pod) => pod.getStatus());
    const expectedKeys = [...new Set(statuses)].sort().reverse();
    const result = podStore.getStatuses(pods);

    expect(Object.keys(result)).toEqual(expectedKeys);
    expect(Object.entries(result)).toEqual(
      expectedKeys.map((key) => [key, statuses.filter((status) => status === key).length]),
    );
  });

  it("returns an empty object for no pods", () => {
    expect(podStore.getStatuses([])).toEqual({});
  });

  it("counts statuses properly", () => {
    const statuses = Object.entries(
      podStore.getStatuses([pendingPod, pendingPod, pendingPod, runningPod, failedPod, failedPod]),
    );

    expect(statuses).toEqual([
      ["Running", 1],
      ["Pending", 3],
      ["Failed", 2],
    ]);
  });

  describe("owner, node and PVC lookups", () => {
    const ownedPod = new Pod({
      apiVersion: "foo",
      kind: "Pod",
      metadata: {
        name: "owned-pod",
        resourceVersion: "1",
        uid: "owned-pod",
        namespace: "default",
        selfLink: "/api/v1/pods/default/owned-pod",
        ownerReferences: [
          {
            apiVersion: "apps/v1",
            kind: "ReplicaSet",
            name: "some-replica-set",
            uid: "some-owner",
          },
        ],
      },
      spec: {
        nodeName: "some-node",
        volumes: [
          { name: "data", persistentVolumeClaim: { claimName: "some-claim" } },
          // A second volume of the same pod mounting the same claim must
          // not list the pod twice for that claim.
          { name: "data-again", persistentVolumeClaim: { claimName: "some-claim" } },
        ],
      },
    } as ConstructorParameters<typeof Pod>[0]);

    const otherPod = new Pod({
      apiVersion: "foo",
      kind: "Pod",
      metadata: {
        name: "other-pod",
        resourceVersion: "1",
        uid: "other-pod",
        namespace: "kube-system",
        selfLink: "/api/v1/pods/kube-system/other-pod",
        ownerReferences: [
          {
            apiVersion: "apps/v1",
            kind: "DaemonSet",
            name: "some-daemon-set",
            uid: "other-owner",
          },
        ],
      },
      spec: {
        nodeName: "other-node",
        volumes: [{ name: "data", persistentVolumeClaim: { claimName: "some-claim" } }],
      },
    } as ConstructorParameters<typeof Pod>[0]);

    beforeEach(() => {
      podStore.items.replace([ownedPod, otherPod]);
    });

    it("gets pods by owner id", () => {
      expect(podStore.getPodsByOwnerId("some-owner")).toEqual([ownedPod]);
      expect(podStore.getPodsByOwnerId("other-owner")).toEqual([otherPod]);
      expect(podStore.getPodsByOwnerId("no-such-owner")).toEqual([]);
    });

    it("gets pods by node only once loaded", () => {
      expect(podStore.getPodsByNode("some-node")).toEqual([]);

      podStore.isLoaded = true;

      expect(podStore.getPodsByNode("some-node")).toEqual([ownedPod]);
      expect(podStore.getPodsByNode("other-node")).toEqual([otherPod]);
      expect(podStore.getPodsByNode("no-such-node")).toEqual([]);
    });

    it("gets pods by PVC claim within the claim's namespace, without duplicates", () => {
      expect(podStore.getPodsByPvc("default", "some-claim")).toEqual([ownedPod]);
      expect(podStore.getPodsByPvc("kube-system", "some-claim")).toEqual([otherPod]);
      expect(podStore.getPodsByPvc("default", "no-such-claim")).toEqual([]);
    });

    it("does not let callers mutate the results of later lookups", () => {
      podStore.getPodsByOwnerId("some-owner").length = 0;
      podStore.getPodsByPvc("default", "some-claim").length = 0;

      expect(podStore.getPodsByOwnerId("some-owner")).toEqual([ownedPod]);
      expect(podStore.getPodsByPvc("default", "some-claim")).toEqual([ownedPod]);
    });
  });
});
