/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { formatKubeApiResource } from "../../common/rbac";
import { createCanListResource } from "./create-request-namespace-list-permissions.injectable";
import { getResourcesToShow } from "./get-resources-to-show";

import type { V1ResourceRule } from "@kubernetes/client-node";

import type { KubeApiResource } from "../../common/rbac";
import type { RequestNamespaceListPermissions } from "./create-request-namespace-list-permissions.injectable";

// The implementation this replaced: every namespace reviewed, 5 at a time.
const referenceGetResourcesToShow = async (
  allowedNamespaces: string[],
  knownResources: KubeApiResource[],
  req: RequestNamespaceListPermissions,
) => {
  if (!allowedNamespaces.length) {
    return [];
  }

  const canListResources = await Promise.all(allowedNamespaces.map(req));

  return knownResources.filter((resource) => canListResources.some((fn) => fn(resource))).map(formatKubeApiResource);
};

const resources: KubeApiResource[] = ["pods", "secrets", "deployments", "nodes", "widgets"].map((apiName, i) => ({
  apiName,
  kind: apiName,
  group: i < 2 ? "" : i === 2 ? "apps" : i === 3 ? "" : "example.com",
  version: "v1",
  namespaced: i !== 3,
}));

const setup = (rulesByNamespace: Record<string, V1ResourceRule[] | "fail" | "allow">) => {
  const calls: string[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const req: RequestNamespaceListPermissions = async (namespace) => {
    calls.push(namespace);
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 1));
    inFlight -= 1;

    const rules = rulesByNamespace[namespace];

    return rules === "fail" || rules === "allow" ? () => true : createCanListResource(rules);
  };

  return { req, calls, maxInFlight: () => maxInFlight };
};

const namespaces = Array.from({ length: 100 }, (_, i) => `ns-${i}`);

describe("getResourcesToShow", () => {
  it("asks only the first namespace for an admin", async () => {
    const { req, calls } = setup(
      Object.fromEntries(namespaces.map((ns) => [ns, [{ apiGroups: ["*"], resources: ["*"], verbs: ["list"] }]])),
    );

    await getResourcesToShow(namespaces, resources, req);

    expect(calls).toEqual(["ns-0"]);
  });

  it("gives the same answer as reviewing every namespace when grants are disjoint", async () => {
    const rules: Record<string, V1ResourceRule[]> = {};

    namespaces.forEach((ns, i) => {
      rules[ns] =
        i % 7 === 3
          ? [{ apiGroups: ["example.com"], resources: ["widgets"], verbs: ["list"] }]
          : i === 90
            ? [{ apiGroups: [""], resources: ["secrets"], verbs: ["get", "list"] }]
            : [{ apiGroups: [""], resources: ["pods"], verbs: ["get"] }];
    });

    const { req, calls, maxInFlight } = setup(rules);
    const result = await getResourcesToShow(namespaces, resources, req);

    expect(result).toEqual(await referenceGetResourcesToShow(namespaces, resources, setup(rules).req));
    expect(result).toEqual(["secrets", "example.com/widgets"]);
    expect(calls).toHaveLength(100);
    expect(maxInFlight()).toBeLessThanOrEqual(16);
    expect(maxInFlight()).toBeGreaterThan(1);
  });

  it("keeps the order of the known resources", async () => {
    const rules = Object.fromEntries(
      namespaces.map((ns, i) => [
        ns,
        [{ apiGroups: ["*"], resources: [i % 2 ? "widgets" : "pods", i % 3 ? "nodes" : "secrets"], verbs: ["list"] }],
      ]),
    );

    expect(await getResourcesToShow(namespaces, resources, setup(rules).req)).toEqual(
      await referenceGetResourcesToShow(namespaces, resources, setup(rules).req),
    );
  });

  it("treats a failed or incomplete review as allowing everything", async () => {
    const rules: Record<string, V1ResourceRule[] | "fail"> = { "ns-0": [], "ns-1": "fail", "ns-2": [] };
    const ns = ["ns-0", "ns-1", "ns-2"];

    expect(await getResourcesToShow(ns, resources, setup(rules).req)).toHaveLength(resources.length);
  });

  it("returns nothing for no namespaces and no resources, without reviewing", async () => {
    const { req, calls } = setup({});

    expect(await getResourcesToShow([], resources, req)).toEqual([]);
    expect(await getResourcesToShow(["a", "b"], [], req)).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("rejects like before when a review rejects", async () => {
    const req: RequestNamespaceListPermissions = async () => {
      throw new Error("boom");
    };

    await expect(getResourcesToShow(["a"], resources, req)).rejects.toThrow("boom");
  });
});
