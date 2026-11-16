/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { PodMetrics } from "@freelensapp/kube-object";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import directoryForKubeConfigsInjectable from "../../../common/app-paths/directory-for-kube-configs/directory-for-kube-configs.injectable";
import directoryForUserDataInjectable from "../../../common/app-paths/directory-for-user-data/directory-for-user-data.injectable";
import { Cluster } from "../../../common/cluster/cluster";
import { formatKubeApiResource } from "../../../common/rbac";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import { getDiForUnitTesting } from "../../getDiForUnitTesting";
import storesAndApisCanBeCreatedInjectable from "../../stores-apis-can-be-created.injectable";
import podStoreInjectable from "./store.injectable";

import type { Mock } from "vitest";

import type { PodStore, PodStoreDependencies } from "./store";

const podMetricsResource = formatKubeApiResource({ apiName: "pods", group: "metrics.k8s.io" });

const metricsFor = (name: string, namespace = "default") =>
  new PodMetrics({
    apiVersion: "metrics.k8s.io/v1beta1",
    kind: "PodMetrics",
    metadata: {
      name,
      namespace,
      resourceVersion: "1",
      uid: name,
      selfLink: `/apis/metrics.k8s.io/v1beta1/namespaces/${namespace}/pods/${name}`,
    },
    containers: [],
    timestamp: "2026-11-13T00:00:00Z",
    window: "30s",
  } as ConstructorParameters<typeof PodMetrics>[0]);

describe("PodStore kube metrics", () => {
  let cluster: Cluster;
  let podStore: PodStore;
  let listMetrics: Mock<PodStoreDependencies["podMetricsApi"]["list"]>;

  beforeEach(() => {
    const di = getDiForUnitTesting();

    di.override(directoryForUserDataInjectable, () => "/some-user-store-path");
    di.override(directoryForKubeConfigsInjectable, () => "/some-kube-configs");
    di.override(storesAndApisCanBeCreatedInjectable, () => true);

    cluster = new Cluster({
      contextName: "some-context-name",
      id: "some-cluster-id",
      kubeConfigPath: "/some-path-to-a-kubeconfig",
    });
    cluster.resourcesToShow.add(podMetricsResource);
    di.override(hostedClusterInjectable, () => cluster);

    podStore = di.inject(podStoreInjectable);

    listMetrics = vi.fn(async () => [metricsFor("some-pod")]);
    podStore["dependencies"].podMetricsApi.list = listMetrics;
  });

  it("loads the metrics of a cluster that serves them", async () => {
    await podStore.loadKubeMetrics();

    expect(listMetrics).toHaveBeenCalledTimes(1);
    expect(podStore.kubeMetrics.map((metrics) => metrics.getName())).toEqual(["some-pod"]);
  });

  it("keeps the metrics of the other namespaces when it loads one namespace", async () => {
    listMetrics.mockImplementation(async ({ namespace } = {}) => [metricsFor(`pod-of-${namespace}`, namespace)]);

    await podStore.loadKubeMetrics("a");
    await podStore.loadKubeMetrics("b");
    await podStore.loadKubeMetrics("a");

    expect(podStore.kubeMetrics.map((metrics) => metrics.getName()).sort()).toEqual(["pod-of-a", "pod-of-b"]);
  });

  it("falls back to the selected namespaces when the cluster-wide list is forbidden", async () => {
    (podStore["dependencies"] as { context: unknown }).context = { contextNamespaces: ["a", "b"] };
    listMetrics.mockImplementation(async ({ namespace } = {}) => {
      if (!namespace) {
        throw { code: 403, message: "forbidden" };
      }

      return namespace === "b" ? [] : [metricsFor(`pod-of-${namespace}`, namespace)];
    });

    await podStore.loadKubeMetrics();

    expect(podStore.kubeMetrics.map((metrics) => metrics.getName())).toEqual(["pod-of-a"]);
  });

  it("does not request the metrics of a cluster that does not serve them", async () => {
    cluster.resourcesToShow.delete(podMetricsResource);

    await podStore.loadKubeMetrics();

    expect(listMetrics).not.toHaveBeenCalled();
  });

  describe("hiding completed pods", () => {
    it("lists and watches every pod by default", () => {
      expect(podStore.query).toEqual({});
      expect(podStore["watchQuery"]).toEqual({});
    });

    it("leaves out Succeeded pods in the list and the watch when the cluster says so", () => {
      const keyBefore = podStore.listQueryKey;

      cluster.preferences.hideCompletedPods = true;

      expect(podStore.query).toEqual({ fieldSelector: "status.phase!=Succeeded" });
      expect(podStore["watchQuery"]).toEqual({ fieldSelector: "status.phase!=Succeeded" });
      expect(podStore.listQueryKey).not.toBe(keyBefore);
    });
  });

  describe("when the request fails", () => {
    beforeEach(async () => {
      vi.useFakeTimers();
      vi.spyOn(console, "warn").mockImplementation(() => {});
      listMetrics.mockRejectedValue(new Error("service unavailable"));
      await podStore.loadKubeMetrics();
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it("skips the polls of the next 10 seconds", async () => {
      vi.advanceTimersByTime(9_000);
      await podStore.loadKubeMetrics();

      expect(listMetrics).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1_000);
      await podStore.loadKubeMetrics();

      expect(listMetrics).toHaveBeenCalledTimes(2);
    });
  });
});
