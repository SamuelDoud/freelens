/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { noop } from "es-toolkit";
import { action, computed, observable, reaction } from "mobx";
import { resetNowInternalState } from "mobx-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import requestClusterMetricsByNodeNamesInjectable from "../../../common/k8s-api/endpoints/metrics.api/request-cluster-metrics-by-node-names.injectable";
import frameActivityInjectable from "../../../features/frame-activity/renderer/frame-activity.injectable";
import { getDiForUnitTesting } from "../../getDiForUnitTesting";
import clusterOverviewMetricsInjectable from "./cluster-metrics.injectable";
import metricsTimeRangeStorageInjectable from "./overview/metrics-time-range-storage.injectable";
import selectedMetricsTimeRangeInjectable from "./overview/selected-metrics-time-range.injectable";
import selectedNodeRoleForMetricsInjectable from "./overview/selected-node-role-for-metrics.injectable";

import type { MetricNodeRole } from "./overview/storage.injectable";

describe("cluster-overview-metrics injectable", () => {
  const timestamps = { start: 100, end: 200, range: 100 };

  const setup = ({
    role,
    masterNodes,
    workerNodes,
  }: {
    role: MetricNodeRole;
    masterNodes: string[];
    workerNodes: string[];
  }) => {
    const di = getDiForUnitTesting();
    const requestClusterMetricsByNodeNames = vi.fn().mockResolvedValue({});
    const nodes = (role === "master" ? masterNodes : workerNodes).map((name) => ({ getName: () => name }));

    di.override(requestClusterMetricsByNodeNamesInjectable, () => requestClusterMetricsByNodeNames);
    di.override(
      selectedMetricsTimeRangeInjectable,
      () => ({ timestamps: computed(() => timestamps), value: computed(() => ({ duration: null })) }) as never,
    );
    di.override(
      selectedNodeRoleForMetricsInjectable,
      () =>
        ({
          value: computed(() => role),
          nodes: computed(() => nodes),
          hasMasterNodes: computed(() => masterNodes.length > 0),
          hasWorkerNodes: computed(() => workerNodes.length > 0),
          set: vi.fn(),
        }) as never,
    );

    di.inject(clusterOverviewMetricsInjectable).value.get();

    return { requestClusterMetricsByNodeNames };
  };

  it("does not filter by node names when the cluster only has worker nodes", () => {
    const { requestClusterMetricsByNodeNames } = setup({
      role: "worker",
      masterNodes: [],
      workerNodes: ["worker-1", "worker-2"],
    });

    expect(requestClusterMetricsByNodeNames).toHaveBeenCalledWith([], timestamps);
  });

  it("does not filter by node names when the cluster only has master nodes", () => {
    const { requestClusterMetricsByNodeNames } = setup({
      role: "master",
      masterNodes: ["master-1"],
      workerNodes: [],
    });

    expect(requestClusterMetricsByNodeNames).toHaveBeenCalledWith([], timestamps);
  });

  it("does not filter by node names before the nodes are loaded", () => {
    const { requestClusterMetricsByNodeNames } = setup({
      role: "worker",
      masterNodes: [],
      workerNodes: [],
    });

    expect(requestClusterMetricsByNodeNames).toHaveBeenCalledWith([], timestamps);
  });

  it("filters by the worker node names when the cluster has both roles and worker is selected", () => {
    const { requestClusterMetricsByNodeNames } = setup({
      role: "worker",
      masterNodes: ["master-1"],
      workerNodes: ["worker-1", "worker-2"],
    });

    expect(requestClusterMetricsByNodeNames).toHaveBeenCalledWith(["worker-1", "worker-2"], timestamps);
  });

  it("filters by the master node names when the cluster has both roles and master is selected", () => {
    const { requestClusterMetricsByNodeNames } = setup({
      role: "master",
      masterNodes: ["master-1"],
      workerNodes: ["worker-1", "worker-2"],
    });

    expect(requestClusterMetricsByNodeNames).toHaveBeenCalledWith(["master-1"], timestamps);
  });
});

describe("cluster-overview-metrics injectable and the last-point metrics", () => {
  const defaultKeys = [
    "memoryUsage",
    "memoryRequests",
    "memoryLimits",
    "memoryCapacity",
    "memoryAllocatableCapacity",
    "cpuUsage",
    "cpuRequests",
    "cpuLimits",
    "cpuCapacity",
    "cpuAllocatableCapacity",
    "podUsage",
    "podCapacity",
    "podAllocatableCapacity",
  ];

  const setup = (timestamps: { start: number; end: number; range: number }) => {
    const di = getDiForUnitTesting();
    const requestClusterMetricsByNodeNames = vi.fn(async (_names: string[], params?: { metrics?: string[] }) =>
      Object.fromEntries((params?.metrics ?? defaultKeys).map((key) => [key, { data: { result: [] } }])),
    );

    di.override(requestClusterMetricsByNodeNamesInjectable, () => requestClusterMetricsByNodeNames as never);
    di.override(
      selectedMetricsTimeRangeInjectable,
      () => ({ timestamps: computed(() => timestamps), value: computed(() => ({ duration: null })) }) as never,
    );
    di.override(
      selectedNodeRoleForMetricsInjectable,
      () =>
        ({
          nodes: computed(() => []),
          hasMasterNodes: computed(() => false),
          hasWorkerNodes: computed(() => true),
        }) as never,
    );

    return { requestClusterMetricsByNodeNames, metrics: di.inject(clusterOverviewMetricsInjectable) };
  };

  it("asks for the series over the whole range and the other metrics over the end of it", async () => {
    const { requestClusterMetricsByNodeNames, metrics } = setup({ start: 10_000, end: 13_600, range: 3600 });

    metrics.value.get();
    await vi.waitFor(() => expect(requestClusterMetricsByNodeNames).toHaveBeenCalledTimes(2));

    const [series, lastPoints] = requestClusterMetricsByNodeNames.mock.calls.map(([, params]) => params as never) as {
      start: number;
      end: number;
      step?: number;
      metrics: string[];
    }[];

    expect(series).toMatchObject({ start: 10_000, end: 13_600, metrics: ["cpuUsage", "memoryUsage"] });
    expect(lastPoints.end).toBe(13_600);
    expect(lastPoints.step).toBe(60);
    expect((lastPoints.start - 10_000) % 60).toBe(0);
    expect(lastPoints.end - lastPoints.start).toBeLessThanOrEqual(7 * 60);
    expect([...series.metrics, ...lastPoints.metrics].sort()).toEqual([...defaultKeys].sort());
  });

  it("gives the same set of metrics as one request for everything", async () => {
    const { metrics } = setup({ start: 10_000, end: 13_600, range: 3600 });

    metrics.value.get();
    await vi.waitFor(() => expect(Object.keys(metrics.value.get() ?? {}).sort()).toEqual([...defaultKeys].sort()));
  });

  it("makes one request for a range that is not longer than the end of it", async () => {
    const { requestClusterMetricsByNodeNames, metrics } = setup({ start: 100, end: 400, range: 300 });

    metrics.value.get();
    await vi.waitFor(() => expect(requestClusterMetricsByNodeNames).toHaveBeenCalledTimes(1));
    expect(requestClusterMetricsByNodeNames).toHaveBeenCalledWith([], { start: 100, end: 400, range: 300 });
  });
});

describe("cluster-overview-metrics injectable and the clock", () => {
  afterEach(() => {
    vi.useRealTimers();
    resetNowInternalState();
  });

  const setup = (initialRange: { duration: number | null; customStart?: number; customEnd?: number }) => {
    // The clocks are shared by interval: one made under real timers would not tick under fake ones.
    resetNowInternalState();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    const di = getDiForUnitTesting();
    const requestClusterMetricsByNodeNames = vi.fn().mockResolvedValue({});
    const state = observable.box(initialRange, { deep: false });
    const active = observable.box(true);

    di.override(requestClusterMetricsByNodeNamesInjectable, () => requestClusterMetricsByNodeNames);
    di.override(
      metricsTimeRangeStorageInjectable,
      () =>
        ({
          get: () => state.get(),
          set: action((value: never) => state.set(value)),
          merge: action((update: object) => state.set({ ...state.get(), ...update } as never)),
        }) as never,
    );
    di.override(frameActivityInjectable, () => computed(() => active.get()));
    di.override(
      selectedNodeRoleForMetricsInjectable,
      () =>
        ({
          nodes: computed(() => []),
          hasMasterNodes: computed(() => false),
          hasWorkerNodes: computed(() => true),
        }) as never,
    );

    // A chart on screen observes the value, as the overview does.
    reaction(() => di.inject(clusterOverviewMetricsInjectable).value.get(), noop);

    // A refresh asks for the series, and for the rest of the metrics besides.
    const refreshes = () =>
      requestClusterMetricsByNodeNames.mock.calls.filter(([, params]) => params?.metrics?.includes("cpuUsage")).length;

    return { requestClusterMetricsByNodeNames, refreshes, active };
  };

  it("asks again every minute for a range that follows the clock while it is shown", async () => {
    const { refreshes } = setup({ duration: 3600 });

    await vi.advanceTimersByTimeAsync(3 * 60 * 1000 + 500);

    expect(refreshes()).toBe(4);
  });

  it("does not ask again while the frame is hidden, and asks once it is shown again", async () => {
    const { requestClusterMetricsByNodeNames, refreshes, active } = setup({ duration: 3600 });

    action(() => active.set(false))();
    await vi.advanceTimersByTimeAsync(0);
    requestClusterMetricsByNodeNames.mockClear();

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(refreshes()).toBe(0);

    action(() => active.set(true))();
    await vi.advanceTimersByTimeAsync(0);
    expect(refreshes()).toBe(1);
  });

  it("does not ask again for a custom range, which does not move", async () => {
    const { refreshes } = setup({ duration: null, customStart: 1000, customEnd: 2000 });

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(refreshes()).toBe(1);
  });
});
