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
});
