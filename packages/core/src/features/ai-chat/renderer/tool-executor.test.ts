/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiToolExecutor } from "./tool-executor";

import type { KubeApiResource } from "../../../common/rbac";
import type { SearchCondition } from "../../advanced-search/common/conditions";
import type { AiToolCallContext, AiToolExecutorDependencies } from "./tool-executor";

const known: KubeApiResource[] = [
  { kind: "Pod", group: "", version: "v1", apiName: "pods", namespaced: true },
  { kind: "Pod", group: "", version: "v1", apiName: "pods/log", namespaced: true },
  { kind: "Secret", group: "", version: "v1", apiName: "secrets", namespaced: true },
  { kind: "Node", group: "", version: "v1", apiName: "nodes", namespaced: false },
  { kind: "Deployment", group: "apps", version: "v1", apiName: "deployments", namespaced: true },
  { kind: "Widget", group: "example.com", version: "v1beta1", apiName: "widgets", namespaced: true },
  { kind: "Widget", group: "example.com", version: "v1", apiName: "widgets", namespaced: true },
];

const now = Date.parse("2026-11-14T12:00:00Z");

describe("AiToolExecutor", () => {
  let dependencies: AiToolExecutorDependencies;
  let executor: AiToolExecutor;
  let advancedSearch: Map<string, SearchCondition[]>;
  const allowed: AiToolCallContext = { allowChanges: () => true, approve: async () => true };
  const readOnly: AiToolCallContext = { allowChanges: () => false, approve: async () => true };

  beforeEach(() => {
    advancedSearch = new Map();
    dependencies = {
      knownResources: () => known,
      kube: { get: vi.fn(), patch: vi.fn(), del: vi.fn() },
      navigate: vi.fn(),
      showDetails: vi.fn(),
      currentLocation: () => ({ pathname: "/pods", search: "?kube-details=%2Fapi%2Fv1%2Fnamespaces%2Fa%2Fpods%2Fp" }),
      namespaces: { selected: () => ["a"], allSelected: () => false, select: vi.fn() },
      quickSearch: { get: () => "api", set: vi.fn() },
      advancedSearch: {
        get: (key) => advancedSearch.get(key) ?? [],
        set: (key, conditions) => advancedSearch.set(key, conditions),
      },
      now: () => now,
    };
    executor = new AiToolExecutor(dependencies);
  });

  it("lists objects as a table, through the resource's API path and selectors", async () => {
    vi.mocked(dependencies.kube.get).mockResolvedValue({
      items: [
        {
          metadata: { name: "api-1", namespace: "a", creationTimestamp: "2026-11-14T11:00:00Z" },
          spec: { containers: [{}], nodeName: "n1" },
          status: { phase: "Running", containerStatuses: [{ ready: true, restartCount: 2 }] },
        },
        { metadata: { name: "db-1", namespace: "a" }, spec: { containers: [{}] }, status: { phase: "Pending" } },
      ],
    });

    const result = await executor.execute(
      "list_resources",
      { kind: "pod", namespace: "a", labelSelector: "app=x", nameContains: "API" },
      readOnly,
    );

    expect(dependencies.kube.get).toHaveBeenCalledWith("/api/v1/namespaces/a/pods", { labelSelector: "app=x" });
    expect(result).toEqual({
      ok: true,
      text: "1 Pod in a\nname\tnamespace\tready\tstatus\trestarts\tnode\tage\napi-1\ta\t1/1\tRunning\t2\tn1\t60m",
    });
  });

  it("resolves a custom kind to its preferred version and asks for a missing namespace", async () => {
    vi.mocked(dependencies.kube.get).mockResolvedValue({ items: [] });

    await executor.execute("list_resources", { kind: "Widget" }, readOnly);

    expect(dependencies.kube.get).toHaveBeenCalledWith("/apis/example.com/v1/widgets", {});
    expect(await executor.execute("get_resource", { kind: "Widget", name: "w" }, readOnly)).toEqual({
      ok: false,
      text: 'Widget is namespaced: "namespace" is required.',
    });
  });

  it("redacts the values of a Secret and drops managed fields", async () => {
    vi.mocked(dependencies.kube.get).mockResolvedValue({
      kind: "Secret",
      metadata: {
        name: "s",
        managedFields: [{ manager: "kubectl" }],
        annotations: { "kubectl.kubernetes.io/last-applied-configuration": '{"data":{"password":"aHVudGVyMg=="}}' },
      },
      data: { password: "aHVudGVyMg==" },
    });

    const { text } = await executor.execute("get_resource", { kind: "Secret", name: "s", namespace: "a" }, readOnly);

    expect(text).not.toContain("aHVudGVyMg==");
    expect(text).toContain("password: <redacted, 12 characters>");
    expect(text).not.toContain("managedFields");
  });

  it("refuses a change tool when the chat does not allow changes", async () => {
    const result = await executor.execute("delete_resource", { kind: "Pod", name: "p", namespace: "a" }, readOnly);

    expect(result.ok).toBe(false);
    expect(result.text).toMatch(/Allow changes/);
    expect(dependencies.kube.del).not.toHaveBeenCalled();
  });

  it("makes a change only once approved", async () => {
    const rejecting: AiToolCallContext = { allowChanges: () => true, approve: async () => false };

    expect((await executor.execute("delete_resource", { kind: "Pod", name: "p", namespace: "a" }, rejecting)).ok).toBe(
      false,
    );
    expect(dependencies.kube.del).not.toHaveBeenCalled();

    expect(await executor.execute("delete_resource", { kind: "Pod", name: "p", namespace: "a" }, allowed)).toEqual({
      ok: true,
      text: "Done: delete Pod a/p",
    });
    expect(dependencies.kube.del).toHaveBeenCalledWith("/api/v1/namespaces/a/pods/p");
  });

  it("scales through the scale subresource with a merge patch", async () => {
    await executor.execute("scale_workload", { kind: "Deployment", name: "web", namespace: "a", replicas: 3 }, allowed);

    expect(dependencies.kube.patch).toHaveBeenCalledWith(
      "/apis/apps/v1/namespaces/a/deployments/web/scale",
      { spec: { replicas: 3 } },
      "application/merge-patch+json",
    );
    expect(
      (
        await executor.execute(
          "scale_workload",
          { kind: "Deployment", name: "web", namespace: "a", replicas: -1 },
          allowed,
        )
      ).ok,
    ).toBe(false);
  });

  it("cordons a node", async () => {
    await executor.execute("set_node_schedulable", { name: "n1", schedulable: false }, allowed);

    expect(dependencies.kube.patch).toHaveBeenCalledWith(
      "/api/v1/nodes/n1",
      { spec: { unschedulable: true } },
      "application/merge-patch+json",
    );
  });

  it("sets advanced search conditions on the kind's view and opens it", async () => {
    const result = await executor.execute(
      "set_advanced_search",
      {
        kind: "Pod",
        conditions: [
          { field: "name", operator: "startsWith", value: "api" },
          { field: "age", operator: "olderThan", value: "1d", negate: true },
        ],
      },
      readOnly,
    );

    expect(result.ok).toBe(true);
    expect(advancedSearch.get("v1/Pod")).toEqual([
      expect.objectContaining({ kind: "text", field: "name", operator: "startsWith", value: "api", negate: false }),
      expect.objectContaining({ kind: "time", field: "age", operator: "olderThan", value: "1d", negate: true }),
    ]);
    expect(dependencies.navigate).toHaveBeenCalledWith("/pods");
    expect(
      (
        await executor.execute(
          "set_advanced_search",
          { kind: "Pod", conditions: [{ field: "name", operator: "like", value: "x" }] },
          readOnly,
        )
      ).ok,
    ).toBe(false);
  });

  it("opens views and details", async () => {
    await executor.execute("open_view", { kind: "Deployment" }, readOnly);
    await executor.execute("open_view", { kind: "Widget" }, readOnly);
    await executor.execute("open_view", { view: "cluster-overview" }, readOnly);
    await executor.execute("show_details", { kind: "Node", name: "n1" }, readOnly);

    expect(vi.mocked(dependencies.navigate).mock.calls).toEqual([
      ["/deployments"],
      ["/crd/example.com/widgets"],
      ["/overview"],
    ]);
    expect(dependencies.showDetails).toHaveBeenCalledWith("/api/v1/nodes/n1");
  });

  it("reports the current view", async () => {
    const { text } = await executor.execute("get_current_view", {}, readOnly);

    expect(text).toContain("path: /pods");
    expect(text).toContain("quickSearch: api");
    expect(text).toContain("detailsOpenFor: /api/v1/namespaces/a/pods/p");
  });

  it("shows the conditions that hold for kinds it has no columns for", async () => {
    vi.mocked(dependencies.kube.get).mockResolvedValue({
      items: [
        { metadata: { name: "v1.ok" }, status: { conditions: [{ type: "Available", status: "True" }] } },
        { metadata: { name: "v1.down" }, status: { conditions: [{ type: "Available", status: "False" }] } },
      ],
    });

    const { text } = await executor.execute("list_resources", { kind: "Widget" }, readOnly);

    expect(text.split("\n")).toEqual([
      "2 Widgets",
      "name\tconditions\tage",
      "v1.ok\tAvailable\t",
      "v1.down\tAvailable=False\t",
    ]);
  });

  it("explains an unknown kind", async () => {
    expect((await executor.execute("list_resources", { kind: "Gadget" }, readOnly)).text).toMatch(
      /does not serve the kind Gadget/,
    );
  });

  describe("filters and order of list_resources", () => {
    // 700 pods in name order, as the API lists them; the restarted and failing ones come after the
    // first 500, which the row limit alone would cut off.
    const pod = (index: number, { restarts = 0, reason = "", ready = true } = {}) => ({
      metadata: {
        name: `collector-${String(index).padStart(3, "0")}`,
        namespace: "telemetry",
        creationTimestamp: new Date(now - (700 - index) * 60_000).toISOString(),
      },
      spec: { containers: [{}] },
      status: {
        phase: "Running",
        containerStatuses: [
          { ready, restartCount: restarts, state: reason ? { waiting: { reason } } : { running: {} } },
        ],
      },
    });
    const pods = Array.from({ length: 700 }, (_, index) => {
      if (index === 600) return pod(index, { restarts: 3 });
      if (index === 650) return pod(index, { restarts: 12, reason: "CrashLoopBackOff", ready: false });
      if (index === 690) return pod(index, { restarts: 1 });
      if (index === 10) return pod(index, { reason: "ImagePullBackOff", ready: false });

      return pod(index);
    });
    const names = (text: string) =>
      text
        .split("\n")
        .slice(2)
        .map((line) => line.split("\t")[0]);

    beforeEach(() => {
      vi.mocked(dependencies.kube.get).mockResolvedValue({ items: pods });
    });

    it("finds the pods that restarted past the first 500, most restarts first", async () => {
      const { text } = await executor.execute(
        "list_resources",
        { kind: "Pod", namespace: "telemetry", minRestarts: 1, sortBy: "restarts", limit: 500 },
        readOnly,
      );

      expect(text.split("\n")[0]).toBe("700 Pods in telemetry, 3 matching, by restarts");
      expect(names(text)).toEqual(["collector-650", "collector-600", "collector-690"]);
    });

    it("filters on the status column, any case, and leaves values out", async () => {
      const failing = await executor.execute(
        "list_resources",
        { kind: "Pod", namespace: "telemetry", status: "crashloopbackoff, ImagePullBackOff" },
        readOnly,
      );
      const notRunning = await executor.execute(
        "list_resources",
        { kind: "Pod", namespace: "telemetry", statusNot: "Running" },
        readOnly,
      );

      expect(names(failing.text)).toEqual(["collector-010", "collector-650"]);
      expect(names(notRunning.text)).toEqual(["collector-010", "collector-650"]);
    });

    it("finds the pods that are not ready, and sorts by age", async () => {
      const { text } = await executor.execute(
        "list_resources",
        { kind: "Pod", namespace: "telemetry", notReady: true, sortBy: "newest" },
        readOnly,
      );

      expect(text.split("\n")[0]).toBe("700 Pods in telemetry, 2 matching, by newest");
      expect(names(text)).toEqual(["collector-650", "collector-010"]);
    });

    it("cuts to the limit after sorting, and says so", async () => {
      const { text } = await executor.execute(
        "list_resources",
        { kind: "Pod", namespace: "telemetry", sortBy: "oldest", limit: 2 },
        readOnly,
      );

      expect(text.split("\n")[0]).toBe("700 Pods in telemetry, by oldest, the first 2 shown");
      expect(names(text)).toEqual(["collector-000", "collector-001"]);
    });

    it("lists as before without them", async () => {
      const { text } = await executor.execute("list_resources", { kind: "Pod", namespace: "telemetry" }, readOnly);

      expect(text.split("\n")[0]).toBe("700 Pods in telemetry, the first 100 shown");
      expect(names(text)[0]).toBe("collector-000");
    });

    it("refuses an order it does not know", async () => {
      const result = await executor.execute("list_resources", { kind: "Pod", sortBy: "cpu" }, readOnly);

      expect(result).toEqual({ ok: false, text: '"sortBy" must be one of name, restarts, newest, oldest, status.' });
    });
  });

  describe("filters on columns a kind lacks", () => {
    it("says which columns the kind has instead of listing nothing", async () => {
      vi.mocked(dependencies.kube.get).mockResolvedValue({
        items: [{ metadata: { name: "api", namespace: "a" }, spec: { replicas: 2 }, status: { readyReplicas: 2 } }],
      });

      const result = await executor.execute("list_resources", { kind: "Deployment", minRestarts: 1 }, readOnly);

      expect(result.ok).toBe(false);
      expect(result.text).toBe(
        '"minRestarts" filters the restarts column, which Deployment does not have. Its columns: ready, available.',
      );
    });
  });

  describe("pods with init containers", () => {
    const pod = (name: string, init: unknown[], phase = "Pending") => ({
      metadata: { name, namespace: "a" },
      spec: { containers: [{}], initContainers: [{}, {}] },
      status: { phase, initContainerStatuses: init },
    });

    it("shows the status kubectl shows, and filters on it", async () => {
      vi.mocked(dependencies.kube.get).mockResolvedValue({
        items: [
          pod("crash", [
            { state: { terminated: { exitCode: 0 } } },
            { state: { waiting: { reason: "CrashLoopBackOff" } } },
          ]),
          pod("failed", [{ state: { terminated: { exitCode: 1, reason: "Error" } } }, { state: {} }]),
          pod("slow", [{ state: { terminated: { exitCode: 0 } } }, { state: { running: {} } }]),
        ],
      });

      const all = await executor.execute("list_resources", { kind: "Pod" }, readOnly);

      expect(all.text).toContain("crash\ta\t0/1\tInit:CrashLoopBackOff");
      expect(all.text).toContain("failed\ta\t0/1\tInit:Error");
      expect(all.text).toContain("slow\ta\t0/1\tInit:1/2");

      const filtered = await executor.execute("list_resources", { kind: "Pod", status: "Init:Error" }, readOnly);

      expect(filtered.text).toContain("failed");
      expect(filtered.text).not.toContain("crash");
    });
  });

  describe("logs and events", () => {
    it("keeps the newest lines of a log that is cut, not the oldest", async () => {
      const log = Array.from({ length: 1000 }, (_, index) => `line-${String(index).padStart(4, "0")} ${"x".repeat(80)}`)
        .join("\n")
        .concat("\n");

      vi.mocked(dependencies.kube.get).mockResolvedValue(log);

      const { ok, text } = await executor.execute(
        "get_pod_logs",
        { name: "p", namespace: "a", tailLines: 1000 },
        readOnly,
      );

      expect(ok).toBe(true);
      expect(text).toContain("line-0999");
      expect(text).not.toContain("line-0000");
      expect(text.split("\n")[0]).toMatch(/cut/);
    });

    it("matches the kind of an event query whatever its case", async () => {
      vi.mocked(dependencies.kube.get).mockResolvedValue({ items: [] });

      await executor.execute("get_events", { kind: "deployment", name: "api", namespace: "a" }, readOnly);

      expect(dependencies.kube.get).toHaveBeenCalledWith("/api/v1/namespaces/a/events", {
        fieldSelector: "involvedObject.kind=Deployment,involvedObject.name=api",
      });
    });

    it("does not call a finished pod not ready", async () => {
      vi.mocked(dependencies.kube.get).mockResolvedValue({
        items: [
          {
            metadata: { name: "job-1", namespace: "a" },
            spec: { containers: [{}] },
            status: {
              phase: "Succeeded",
              containerStatuses: [{ ready: false, state: { terminated: { reason: "Completed" } } }],
            },
          },
          {
            metadata: { name: "web-1", namespace: "a" },
            spec: { containers: [{}] },
            status: { phase: "Running", containerStatuses: [{ ready: false }] },
          },
        ],
      });

      const { text } = await executor.execute("list_resources", { kind: "Pod", notReady: true }, readOnly);

      expect(text).toContain("web-1");
      expect(text).not.toContain("job-1");
    });
  });
});
