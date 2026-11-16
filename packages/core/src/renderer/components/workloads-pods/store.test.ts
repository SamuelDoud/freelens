/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Pod, PodMetrics } from "@freelensapp/kube-object";
import { cpuUnitsToNumber, unitsToBytes } from "@freelensapp/utilities";
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

describe("PodStore getPodKubeMetrics", () => {
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

  const podWith = (name: string, containers: string[]) =>
    new Pod({
      apiVersion: "v1",
      kind: "Pod",
      metadata: { name, namespace: "default", resourceVersion: "1", uid: name, selfLink: `/api/v1/pods/${name}` },
      spec: { containers: containers.map((container) => ({ name: container, image: "i" })) },
    } as unknown as ConstructorParameters<typeof Pod>[0]);

  const usageFor = (name: string, containers: { name: string; usage?: Record<string, string> }[]) =>
    new PodMetrics({
      apiVersion: "metrics.k8s.io/v1beta1",
      kind: "PodMetrics",
      metadata: { name, namespace: "default", resourceVersion: "1", uid: name, selfLink: `/x/${name}` },
      containers,
      timestamp: "2026-11-13T00:00:00Z",
      window: "30s",
    } as unknown as ConstructorParameters<typeof PodMetrics>[0]);

  // The implementation before the cache, kept to compare against.
  const reference = (pod: Pod) => {
    const containers = pod.getContainers();
    const metrics = podStore.kubeMetricsByPod.get(`${pod.getNs()}/${pod.getName()}`);

    if (!metrics || !metrics.containers || !containers) return { cpu: NaN, memory: NaN };

    return containers.reduce(
      (total, container) => {
        const metric = metrics.containers?.find((item) => item.name == container.name);
        const cpu = (metric?.usage && metric.usage.cpu) || "0";
        const memory = (metric?.usage && metric.usage.memory) || "0";

        return {
          cpu: total.cpu + (cpuUnitsToNumber(cpu) ?? 0),
          memory: total.memory + unitsToBytes(memory),
        };
      },
      { cpu: 0, memory: 0 },
    );
  };

  it("gives the values of the uncached computation, and follows a new metrics object or pod", () => {
    const pods = [podWith("a", ["x", "y"]), podWith("b", ["x"]), podWith("none", ["x"]), podWith("empty", [])];

    podStore.kubeMetrics.replace([
      usageFor("a", [
        { name: "x", usage: { cpu: "250m", memory: "128Mi" } },
        { name: "y", usage: { cpu: "1500000n", memory: "1Gi" } },
      ]),
      usageFor("b", [{ name: "other" }]),
      usageFor("empty", [{ name: "x", usage: { cpu: "1", memory: "1" } }]),
    ]);

    for (let pass = 0; pass < 2; pass++) {
      for (const pod of pods) {
        expect(podStore.getPodKubeMetrics(pod)).toEqual(reference(pod));
      }
    }

    expect(podStore.getPodKubeMetrics(pods[0])).toEqual({ cpu: 0.2515, memory: 128 * 1024 ** 2 + 1024 ** 3 });
    expect(podStore.getPodKubeMetrics(pods[2])).toEqual({ cpu: NaN, memory: NaN });

    podStore.kubeMetrics.replace([usageFor("a", [{ name: "x", usage: { cpu: "2", memory: "1Ki" } }])]);

    for (const pod of pods) {
      expect(podStore.getPodKubeMetrics(pod)).toEqual(reference(pod));
    }

    expect(podStore.getPodKubeMetrics(pods[0])).toEqual({ cpu: 2, memory: 1024 });

    const replaced = podWith("a", ["y"]);

    expect(podStore.getPodKubeMetrics(replaced)).toEqual(reference(replaced));
  });

  it("returns a new object per call", () => {
    const pod = podWith("a", ["x"]);

    podStore.kubeMetrics.replace([usageFor("a", [{ name: "x", usage: { cpu: "1", memory: "1" } }])]);

    const first = podStore.getPodKubeMetrics(pod);

    first.cpu = 99;

    expect(podStore.getPodKubeMetrics(pod).cpu).toBe(1);
  });
});
