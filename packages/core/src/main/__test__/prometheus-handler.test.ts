/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { prometheusProviderInjectionToken } from "@freelensapp/prometheus";
import { getInjectable } from "@ogre-tools/injectable";
import { runInAction } from "mobx";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import directoryForUserDataInjectable from "../../common/app-paths/directory-for-user-data/directory-for-user-data.injectable";
import { Cluster } from "../../common/cluster/cluster";
import writeJsonFileInjectable from "../../common/fs/write-json-file.injectable";
import {
  prometheusDiscoveryTtlMs,
  prometheusFailedDiscoveryTtlMs,
} from "../cluster/prometheus-handler/prometheus-handler";
import prometheusHandlerInjectable from "../cluster/prometheus-handler/prometheus-handler.injectable";
import createFreelensK8sProxyInjectable from "../freelens-k8s-proxy/create-freelens-k8s-proxy.injectable";
import freelensProxyPortInjectable from "../freelens-proxy/freelens-proxy-port.injectable";
import { getDiForUnitTesting } from "../getDiForUnitTesting";

import type { PrometheusProvider } from "@freelensapp/prometheus";

import type { DiContainer } from "@ogre-tools/injectable";

enum ServiceResult {
  Success,
  Failure,
}

const createTestPrometheusProvider = (kind: string, alwaysFail: ServiceResult): PrometheusProvider => ({
  kind,
  name: "TestProvider1",
  isConfigurable: false,
  getQuery: () => {
    throw new Error("getQuery is not implemented.");
  },
  getPrometheusService: async () => {
    switch (alwaysFail) {
      case ServiceResult.Success:
        return {
          kind,
          namespace: "default",
          port: 7000,
          service: "",
        };
      case ServiceResult.Failure:
        throw new Error("does fail");
    }
  },
});

describe("PrometheusHandler", () => {
  let di: DiContainer;
  let cluster: Cluster;

  beforeEach(async () => {
    di = getDiForUnitTesting();
    di.override(createFreelensK8sProxyInjectable, () => () => ({
      apiPrefix: "/some-api-prefix",
      exit: () => {},
      run: async () => {},
      port: 9191,
      isRunning: true,
    }));
    di.override(directoryForUserDataInjectable, () => "/some-user-data-dir");
    di.inject(freelensProxyPortInjectable).set(12345);

    const writeJsonFile = di.inject(writeJsonFileInjectable);
    const kubeConfigPath = "/some/path-to-a-config";
    const contextName = "some-context-name";

    await writeJsonFile(kubeConfigPath, {
      apiVersion: "v1",
      kind: "Config",
      clusters: [
        {
          name: "some-cluster-name",
          cluster: {
            server: "https://localhost:8989",
          },
        },
      ],
      users: [
        {
          name: "some-user-name",
        },
      ],
      contexts: [
        {
          name: contextName,
          context: {
            user: "some-user-name",
            cluster: "some-cluster-name",
          },
        },
      ],
    });

    cluster = new Cluster({
      contextName,
      id: "some-cluster-id",
      kubeConfigPath,
    });
  });

  describe("finding the Prometheus service", () => {
    let searches: number;
    let fails: boolean;

    beforeEach(() => {
      searches = 0;
      fails = false;
      vi.useFakeTimers({ toFake: ["Date"] });
      runInAction(() => {
        di.register(
          getInjectable({
            id: "test-prometheus-provider-counting",
            injectionToken: prometheusProviderInjectionToken,
            instantiate: () => ({
              ...createTestPrometheusProvider("counting", ServiceResult.Success),
              getPrometheusService: async () => {
                searches += 1;

                if (fails) {
                  throw new Error("no prometheus");
                }

                return { kind: "counting", namespace: "monitoring", port: 9090, service: "prometheus" };
              },
            }),
          }),
        );
      });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("searches once for repeated and concurrent requests", async () => {
      const handler = di.inject(prometheusHandlerInjectable, cluster);

      await Promise.all([handler.getPrometheusDetails(), handler.getPrometheusDetails()]);
      const details = await handler.getPrometheusDetails();

      expect(searches).toBe(1);
      expect(details.prometheusPath).toBe("monitoring/services/prometheus:9090");
    });

    it("searches again once the found service is old", async () => {
      const handler = di.inject(prometheusHandlerInjectable, cluster);

      await handler.getPrometheusDetails();
      vi.advanceTimersByTime(prometheusDiscoveryTtlMs - 1);
      await handler.getPrometheusDetails();
      expect(searches).toBe(1);

      vi.advanceTimersByTime(1);
      await handler.getPrometheusDetails();
      expect(searches).toBe(2);
    });

    it("retries a failed search after a shorter time", async () => {
      const handler = di.inject(prometheusHandlerInjectable, cluster);

      fails = true;
      await expect(handler.getPrometheusDetails()).rejects.toThrowError();
      await expect(handler.getPrometheusDetails()).rejects.toThrowError();
      expect(searches).toBe(1);

      fails = false;
      vi.advanceTimersByTime(prometheusFailedDiscoveryTtlMs);
      await expect(handler.getPrometheusDetails()).resolves.toBeDefined();
      expect(searches).toBe(2);
    });

    it("does not search when the service is set in the cluster's preferences", async () => {
      cluster.preferences.prometheusProvider = { type: "counting" };
      cluster.preferences.prometheus = { namespace: "ns", service: "svc", port: 80, prefix: "" };
      const handler = di.inject(prometheusHandlerInjectable, cluster);

      const details = await handler.getPrometheusDetails();

      expect(searches).toBe(0);
      expect(details.prometheusPath).toBe("ns/services/svc:80");
    });
  });

  describe("getPrometheusService", () => {
    it.each([[0], [1], [2], [3]])("should throw after %d failure(s)", async (failures) => {
      runInAction(() => {
        for (let i = 0; i < failures; i += 1) {
          di.register(
            getInjectable({
              id: `test-prometheus-provider-failure-${i}`,
              injectionToken: prometheusProviderInjectionToken,
              instantiate: () => createTestPrometheusProvider(`id_failure_${i}`, ServiceResult.Failure),
            }),
          );
        }
      });

      await expect(() => di.inject(prometheusHandlerInjectable, cluster).getPrometheusDetails()).rejects.toThrowError();
    });

    it.each([
      [1, 0],
      [1, 1],
      [1, 2],
      [1, 3],
      [2, 0],
      [2, 1],
      [2, 2],
      [2, 3],
    ])("should pick the first provider of %d success(es) after %d failure(s)", async (successes, failures) => {
      runInAction(() => {
        for (let i = 0; i < failures; i += 1) {
          di.register(
            getInjectable({
              id: `test-prometheus-provider-failure-${i}`,
              injectionToken: prometheusProviderInjectionToken,
              instantiate: () => createTestPrometheusProvider(`id_failure_${i}`, ServiceResult.Failure),
            }),
          );
        }

        for (let i = 0; i < successes; i += 1) {
          di.register(
            getInjectable({
              id: `test-prometheus-provider-success-${i}`,
              injectionToken: prometheusProviderInjectionToken,
              instantiate: () => createTestPrometheusProvider(`id_success_${i}`, ServiceResult.Success),
            }),
          );
        }
      });

      const details = await di.inject(prometheusHandlerInjectable, cluster).getPrometheusDetails();

      expect(details.provider.kind === `id_failure_${failures}`);
    });

    it.each([
      [1, 0],
      [1, 1],
      [1, 2],
      [1, 3],
      [2, 0],
      [2, 1],
      [2, 2],
      [2, 3],
    ])("should pick the first provider of %d success(es) before %d failure(s)", async (successes, failures) => {
      runInAction(() => {
        for (let i = 0; i < failures; i += 1) {
          di.register(
            getInjectable({
              id: `test-prometheus-provider-failure-${i}`,
              injectionToken: prometheusProviderInjectionToken,
              instantiate: () => createTestPrometheusProvider(`id_failure_${i}`, ServiceResult.Failure),
            }),
          );
        }

        for (let i = 0; i < successes; i += 1) {
          di.register(
            getInjectable({
              id: `test-prometheus-provider-success-${i}`,
              injectionToken: prometheusProviderInjectionToken,
              instantiate: () => createTestPrometheusProvider(`id_success_${i}`, ServiceResult.Success),
            }),
          );
        }
      });

      const details = await di.inject(prometheusHandlerInjectable, cluster).getPrometheusDetails();

      expect(details.provider.kind === "id_failure_0");
    });

    it.each([
      [1, 0],
      [1, 1],
      [1, 2],
      [1, 3],
      [2, 0],
      [2, 1],
      [2, 2],
      [2, 3],
    ])("should pick the first provider of %d success(es) between %d failure(s)", async (successes, failures) => {
      const beforeSuccesses = Math.floor(successes / 2);

      runInAction(() => {
        for (let i = 0; i < beforeSuccesses; i += 1) {
          di.register(
            getInjectable({
              id: `test-prometheus-provider-success-${i}`,
              injectionToken: prometheusProviderInjectionToken,
              instantiate: () => createTestPrometheusProvider(`id_success_${i}`, ServiceResult.Success),
            }),
          );
        }

        for (let i = 0; i < failures; i += 1) {
          di.register(
            getInjectable({
              id: `test-prometheus-provider-failure-${i}`,
              injectionToken: prometheusProviderInjectionToken,
              instantiate: () => createTestPrometheusProvider(`id_failure_${i}`, ServiceResult.Failure),
            }),
          );
        }

        for (let i = beforeSuccesses; i < successes; i += 1) {
          di.register(
            getInjectable({
              id: `test-prometheus-provider-success-${i}`,
              injectionToken: prometheusProviderInjectionToken,
              instantiate: () => createTestPrometheusProvider(`id_success_${i}`, ServiceResult.Success),
            }),
          );
        }
      });

      const details = await di.inject(prometheusHandlerInjectable, cluster).getPrometheusDetails();

      expect(details.provider.kind === "id_success_0");
    });
  });
});
