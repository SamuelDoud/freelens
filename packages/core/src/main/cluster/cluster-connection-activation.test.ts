/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { loggerInjectionToken } from "@freelensapp/logger";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import directoryForTempInjectable from "../../common/app-paths/directory-for-temp/directory-for-temp.injectable";
import directoryForUserDataInjectable from "../../common/app-paths/directory-for-user-data/directory-for-user-data.injectable";
import createCanIInjectable from "../../common/cluster/create-can-i.injectable";
import createRequestNamespaceListPermissionsInjectable from "../../common/cluster/create-request-namespace-list-permissions.injectable";
import createListNamespacesInjectable from "../../common/cluster/list-namespaces.injectable";
import { ClusterMetadataKey } from "../../common/cluster-types";
import writeJsonFileInjectable from "../../common/fs/write-json-file.injectable";
import writeJsonSyncInjectable from "../../common/fs/write-json-sync.injectable";
import normalizedPlatformInjectable from "../../common/vars/normalized-platform.injectable";
import addClusterInjectable from "../../features/cluster/storage/common/add.injectable";
import clusterVersionDetectorInjectable from "../cluster-detectors/cluster-version-detector.injectable";
import { getDiForUnitTesting } from "../getDiForUnitTesting";
import kubeconfigManagerInjectable from "../kubeconfig-manager/kubeconfig-manager.injectable";
import kubectlBinaryNameInjectable from "../kubectl/binary-name.injectable";
import { Kubectl } from "../kubectl/kubectl";
import kubectlDownloadingNormalizedArchInjectable from "../kubectl/normalized-arch.injectable";
import accessibilityCacheInjectable from "./accessibility-cache.injectable";
import broadcastConnectionUpdateInjectable from "./broadcast-connection-update.injectable";
import clusterConnectionInjectable from "./cluster-connection.injectable";
import freelensK8sProxyManagerInjectable from "./freelens-k8s-proxy-manager.injectable";
import prometheusHandlerInjectable from "./prometheus-handler/prometheus-handler.injectable";
import requestApiResourcesInjectable from "./request-api-resources.injectable";

import type { Logger } from "@freelensapp/logger";

import type { DiContainer } from "@ogre-tools/injectable";
import type { Mock } from "vitest";

import type { Cluster } from "../../common/cluster/cluster";
import type { KubeconfigManager } from "../kubeconfig-manager/kubeconfig-manager";
import type { Accessibility, AccessibilityIdentity } from "./accessibility-cache.injectable";
import type { ClusterConnection } from "./cluster-connection.injectable";
import type { FreelensK8sProxyManager } from "./freelens-k8s-proxy-manager.injectable";

describe("ClusterConnection activation", () => {
  let clusterConnection: ClusterConnection;
  let di: DiContainer;
  let discoveryFails: boolean;
  let cluster: Cluster;
  let restartMock: Mock<() => Promise<void>>;
  let events: string[];
  let pendingRestarts: { resolve: () => void; reject: (error: Error) => void }[];
  // When set, the accessibility calls (canI, namespace listing and API
  // resource discovery) wait for the test to release them instead of
  // resolving at once, so a test can observe which of them have started.
  let accessibilityResolvers: (() => void)[] | undefined;
  // When set, the version detection waits for the test to release it.
  let detectResolvers: (() => void)[] | undefined;

  const countOf = (event: string) => events.filter((each) => each === event).length;

  // Each restart of the proxy waits until the test settles it, like the real
  // one waits for freelens-k8s-proxy to report that it serves.
  const settleRestart = async (index: number, error?: Error) => {
    if (error) {
      pendingRestarts[index].reject(error);
    } else {
      pendingRestarts[index].resolve();
    }

    await vi.advanceTimersByTimeAsync(0);
  };

  // Settles every restart, so that an activation started twice fails its
  // expectations instead of waiting for its second restart forever.
  const settleAllRestarts = async () => {
    for (const { resolve } of pendingRestarts) {
      resolve();
    }

    await vi.advanceTimersByTimeAsync(0);
  };

  beforeEach(() => {
    vi.useFakeTimers();

    di = getDiForUnitTesting();
    const writeJsonSync = di.inject(writeJsonSyncInjectable);

    events = [];
    pendingRestarts = [];
    detectResolvers = undefined;
    discoveryFails = false;

    di.override(directoryForUserDataInjectable, () => "some-directory-for-user-data");
    di.override(directoryForTempInjectable, () => "some-directory-for-temp");
    di.override(kubectlBinaryNameInjectable, () => "kubectl");
    di.override(kubectlDownloadingNormalizedArchInjectable, () => "amd64");
    di.override(normalizedPlatformInjectable, () => "darwin");

    const record = (message: string) => {
      events.push(message);
    };

    di.override(
      loggerInjectionToken,
      () =>
        ({
          debug: vi.fn(),
          info: vi.fn(record),
          warn: vi.fn(),
          error: vi.fn(),
          silly: vi.fn(),
        }) as Partial<Logger> as Logger,
    );
    di.override(broadcastConnectionUpdateInjectable, () => (update) => {
      record(update.message);
    });

    di.override(createCanIInjectable, () => () => (attrs) => {
      record(`canI:${attrs.verb}`);

      return accessibilityResolvers
        ? new Promise<boolean>((resolve) => accessibilityResolvers?.push(() => resolve(true)))
        : Promise.resolve(true);
    });
    di.override(createRequestNamespaceListPermissionsInjectable, () => () => async () => () => true);
    di.override(createListNamespacesInjectable, () => () => () => {
      record("listNamespaces");

      return accessibilityResolvers
        ? new Promise<string[]>((resolve) => accessibilityResolvers?.push(() => resolve(["default"])))
        : Promise.resolve(["default"]);
    });
    di.override(requestApiResourcesInjectable, () => async () => {
      record("requestApiResources");

      if (discoveryFails) {
        return { callWasSuccessful: false as const, error: new Error("some-error") };
      }

      if (accessibilityResolvers) {
        await new Promise<void>((resolve) => accessibilityResolvers?.push(resolve));
      }

      return {
        callWasSuccessful: true,
        response: [{ apiName: "pods", kind: "Pod", group: "", version: "v1", namespaced: true }],
      };
    });
    di.override(prometheusHandlerInjectable, () => ({
      getPrometheusDetails: vi.fn(),
      setupPrometheus: vi.fn(),
    }));

    restartMock = vi.fn(
      () =>
        new Promise<void>((resolve, reject) => {
          record("restart");
          pendingRestarts.push({ resolve, reject });
        }),
    );

    const proxyManagerMock: FreelensK8sProxyManager = {
      getApiTarget: vi.fn().mockResolvedValue({}),
      ensureFreelensK8sProxyUrl: vi.fn().mockResolvedValue("https://127.0.0.1:9999/test"),
      restart: restartMock,
      ensureRunning: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn(),
    };

    di.override(freelensK8sProxyManagerInjectable, () => proxyManagerMock);
    di.override(clusterVersionDetectorInjectable, () => ({
      key: ClusterMetadataKey.VERSION,
      detect: vi.fn(async () => {
        if (detectResolvers) {
          await new Promise<void>((resolve) => detectResolvers?.push(resolve));
        }

        return { value: "v1.28.0", accuracy: 100 };
      }),
    }));
    di.override(
      kubeconfigManagerInjectable,
      () =>
        ({
          ensurePath: async () => "/some-proxy-kubeconfig-file",
        }) as Partial<KubeconfigManager> as KubeconfigManager,
    );

    const kubeconfig = {
      apiVersion: "v1",
      clusters: [{ name: "test-cluster", cluster: { server: "https://192.168.1.1:6443" } }],
      "current-context": "test-cluster",
      contexts: [{ context: { cluster: "test-cluster", user: "test-user" }, name: "test-cluster" }],
      users: [{ name: "test-user", user: {} }],
      kind: "Config",
      preferences: {},
    };

    writeJsonSync("/test-kubeconfig.yml", kubeconfig);
    // An activation is complete only once it has refreshed the accessibility
    // through the proxy kubeconfig.
    writeJsonSync("/some-proxy-kubeconfig-file", kubeconfig);

    vi.spyOn(Kubectl.prototype, "ensureKubectl").mockReturnValue(Promise.resolve(true));

    cluster = di.inject(addClusterInjectable)({
      id: "test-cluster-id",
      contextName: "test-cluster",
      kubeConfigPath: "/test-kubeconfig.yml",
    });

    clusterConnection = di.inject(clusterConnectionInjectable, cluster);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("when two non-forced activations overlap", () => {
    let first: Promise<void>;
    let second: Promise<void>;

    beforeEach(async () => {
      first = clusterConnection.activate();
      second = clusterConnection.activate();
      await vi.advanceTimersByTimeAsync(0);
    });

    it("returns the activation in flight to the second call", () => {
      expect(second).toBe(first);
    });

    it("restarts the proxy once and activates once", async () => {
      await settleAllRestarts();
      await Promise.all([first, second]);

      expect(restartMock).toHaveBeenCalledTimes(1);
      expect(countOf("[CLUSTER]: activate")).toBe(1);
    });

    it("does not report a failed start", async () => {
      await settleAllRestarts();
      await Promise.all([first, second]);

      expect(events.some((event) => event.startsWith("Failed to start connection"))).toBe(false);
    });
  });

  describe("when a forced activation arrives while one is in flight", () => {
    let first: Promise<void>;
    let forced: Promise<void>;

    beforeEach(async () => {
      first = clusterConnection.activate();
      await vi.advanceTimersByTimeAsync(0);
      forced = clusterConnection.activate(true);
      await vi.advanceTimersByTimeAsync(0);
    });

    it("does not start before the one in flight has settled", () => {
      expect(countOf("[CLUSTER]: activate")).toBe(1);
      expect(restartMock).toHaveBeenCalledTimes(1);
    });

    it("runs once, after the one in flight has settled", async () => {
      await settleAllRestarts();
      await Promise.all([first, forced]);

      const firstDone = events.indexOf("Connected, waiting for view to load ...");

      expect(countOf("[CLUSTER]: activate")).toBe(2);
      expect(events.lastIndexOf("[CLUSTER]: activate")).toBeGreaterThan(firstDone);
      expect(firstDone).toBeGreaterThan(-1);
      expect(restartMock).toHaveBeenCalledTimes(1);
    });

    it("runs once, after the one in flight has failed", async () => {
      await settleRestart(0, new Error("freelens-k8s-proxy was stopped before it was ready"));
      await vi.advanceTimersByTimeAsync(0);

      expect(countOf("[CLUSTER]: activate")).toBe(2);
      expect(restartMock).toHaveBeenCalledTimes(2);

      await settleRestart(1);
      await Promise.all([first, forced]);

      expect(countOf("[CLUSTER]: activate")).toBe(2);
      expect(countOf("Connected, waiting for view to load ...")).toBe(1);
    });
  });

  describe("when an activation has succeeded", () => {
    beforeEach(async () => {
      const activation = clusterConnection.activate();

      await vi.advanceTimersByTimeAsync(0);
      await settleRestart(0);
      await activation;
      events = [];
    });

    it("does not activate again on a later non-forced call", async () => {
      await clusterConnection.activate();

      expect(countOf("[CLUSTER]: activate")).toBe(0);
    });

    it("activates again on a later forced call", async () => {
      await clusterConnection.activate(true);

      expect(countOf("[CLUSTER]: activate")).toBe(1);
    });
  });

  describe("when an activation has failed", () => {
    beforeEach(async () => {
      const activation = clusterConnection.activate();

      await vi.advanceTimersByTimeAsync(0);
      await settleRestart(0, new Error("some-error"));
      await activation;
    });

    it("reports the failure", () => {
      expect(events).toContain("Failed to start connection: Error: some-error");
    });

    it("activates again on a later non-forced call", async () => {
      const activation = clusterConnection.activate();

      await vi.advanceTimersByTimeAsync(0);
      await settleRestart(1);
      await activation;

      expect(countOf("[CLUSTER]: activate")).toBe(2);
      expect(restartMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("when a status check is already in flight as the cluster is activated", () => {
    it("waits for the check and goes on to refresh the accessibility", async () => {
      detectResolvers = [];

      const check = clusterConnection.refresh();
      const activation = clusterConnection.activate();

      await vi.advanceTimersByTimeAsync(0);
      await settleRestart(0);
      await vi.advanceTimersByTimeAsync(0);

      // The check begun before the restart ends, then the activation checks anew.
      for (let round = 0; round < 2; round++) {
        for (const resolve of detectResolvers.splice(0)) {
          resolve();
        }

        await vi.advanceTimersByTimeAsync(0);
      }

      await Promise.all([check, activation]);

      expect(countOf("requestApiResources")).toBe(1);
      expect(countOf("Connected, waiting for view to load ...")).toBe(1);
    });
  });

  describe("accessibility refresh", () => {
    it("starts the permission checks, namespace listing and API discovery in parallel", async () => {
      accessibilityResolvers = [];
      const activation = clusterConnection.activate();

      await vi.advanceTimersByTimeAsync(0);
      await settleRestart(0);
      await vi.advanceTimersByTimeAsync(0);

      // None of the four calls has been released, so with sequential awaits
      // only the first one would have started.
      expect(countOf("canI:create")).toBe(1);
      expect(countOf("canI:watch")).toBe(1);
      expect(countOf("canI:list")).toBe(1);
      expect(countOf("listNamespaces")).toBe(1);
      expect(countOf("requestApiResources")).toBe(1);

      for (const resolve of accessibilityResolvers) {
        resolve();
      }

      await activation;

      expect(countOf("Connected, waiting for view to load ...")).toBe(1);
      expect(events.some((event) => event.startsWith("Failed to start connection"))).toBe(false);
    });
  });

  describe("a refresh of accessibility and metadata", () => {
    it("is skipped for a cluster that is disconnected", async () => {
      expect(cluster.disconnected.get()).toBe(true);

      await clusterConnection.refreshAccessibilityAndMetadata();

      expect(countOf("canI:create")).toBe(0);
      expect(countOf("listNamespaces")).toBe(0);
      expect(countOf("requestApiResources")).toBe(0);
    });
  });

  describe("with the accessibility of an earlier connection on disk", () => {
    const identity: AccessibilityIdentity = {
      contextName: "test-cluster",
      userName: "test-user",
      server: "https://192.168.1.1:6443",
    };
    const stale: Accessibility = {
      isAdmin: false,
      isGlobalWatchEnabled: false,
      isGlobalListEnabled: false,
      allowedNamespaces: ["old-namespace"],
      knownResources: [
        { apiName: "pods", kind: "Pod", group: "", version: "v1", namespaced: true },
        { apiName: "widgets", kind: "Widget", group: "example.com", version: "v1", namespaced: true },
      ],
      resourcesToShow: ["pods"],
    };
    const fresh = {
      isAdmin: true,
      isGlobalWatchEnabled: true,
      isGlobalListEnabled: true,
      allowedNamespaces: ["default"],
      knownResources: [{ apiName: "pods", kind: "Pod", group: "", version: "v1", namespaced: true }],
      resourcesToShow: ["pods"],
    };
    // What the cluster has now, as the mocks above answer it
    const releaseAll = async () => {
      while (accessibilityResolvers?.length) {
        accessibilityResolvers.splice(0).forEach((resolve) => resolve());
        await vi.advanceTimersByTimeAsync(0);
      }
    };
    const shown = () => ({
      isAdmin: cluster.isAdmin.get(),
      isGlobalWatchEnabled: cluster.isGlobalWatchEnabled.get(),
      isGlobalListEnabled: cluster.isGlobalListEnabled.get(),
      allowedNamespaces: [...cluster.allowedNamespaces],
      knownResources: [...cluster.knownResources],
      resourcesToShow: [...cluster.resourcesToShow],
    });

    const startActivation = async () => {
      accessibilityResolvers = [];

      const activation = clusterConnection.activate();
      let settled = false;

      activation.then(() => {
        settled = true;
      });
      await vi.advanceTimersByTimeAsync(0);
      await settleRestart(0);

      return { activation, settled: () => settled };
    };

    it("is connected at once with the cached answers, and shows the cluster's when it has answered", async () => {
      await di.inject(accessibilityCacheInjectable, cluster).write(identity, stale);

      const { activation, settled } = await startActivation();

      await vi.advanceTimersByTimeAsync(0);

      expect(settled()).toBe(true);
      expect(cluster.ready.get()).toBe(true);
      expect(shown()).toEqual(stale);
      // The cluster is being asked, and has not answered
      expect(countOf("requestApiResources")).toBe(1);

      await releaseAll();
      await activation;

      expect(shown()).toEqual(fresh);
    });

    it("saves the cluster's answers for the next time, and only when they differ", async () => {
      const cache = di.inject(accessibilityCacheInjectable, cluster);
      const write = vi.spyOn(cache, "write");

      await cache.write(identity, stale);
      write.mockClear();

      const { activation } = await startActivation();

      await releaseAll();
      await activation;

      expect(write).toHaveBeenCalledTimes(1);
      expect(await cache.read(identity)).toEqual(fresh);

      write.mockClear();
      const again = (clusterConnection as unknown as { refreshAccessibility(): Promise<void> }).refreshAccessibility();

      await vi.advanceTimersByTimeAsync(0);
      await releaseAll();
      await again;

      expect(write).not.toHaveBeenCalled();
    });

    it.each([
      ["another user", { ...identity, userName: "other-user" }],
      ["another server", { ...identity, server: "https://10.0.0.1:6443" }],
      ["another context", { ...identity, contextName: "other-context" }],
    ])("waits for the cluster when the cache is of %s", async (_, other) => {
      await di.inject(accessibilityCacheInjectable, cluster).write(other, stale);

      const { activation, settled } = await startActivation();

      await vi.advanceTimersByTimeAsync(0);

      expect(settled()).toBe(false);
      expect(cluster.knownResources.length).toBe(0);

      await releaseAll();
      await activation;

      expect(shown()).toEqual(fresh);
    });

    it.each([
      ["another version", { version: 0, identity, accessibility: stale }],
      ["no accessibility", { version: 1, identity }],
      ["resources of the wrong shape", { version: 1, identity, accessibility: { ...stale, knownResources: [{}] } }],
    ])("ignores a file with %s", async (_, contents) => {
      await di.inject(writeJsonFileInjectable)(
        "some-directory-for-user-data/cluster-accessibility/test-cluster-id.json",
        contents,
      );

      const { settled } = await startActivation();

      await vi.advanceTimersByTimeAsync(0);

      expect(settled()).toBe(false);
      expect(cluster.knownResources.length).toBe(0);
    });

    it("keeps the cached answers when the background refresh finds no resources, and says so", async () => {
      await di.inject(accessibilityCacheInjectable, cluster).write(identity, stale);
      discoveryFails = true;

      const { activation } = await startActivation();

      await releaseAll();
      await activation;

      expect(cluster.knownResources.length).toBe(2);
    });
  });
});
