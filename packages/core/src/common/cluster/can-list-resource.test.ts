/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { createCanListResource } from "./create-request-namespace-list-permissions.injectable";

import type { V1ResourceRule } from "@kubernetes/client-node";

import type { KubeApiResource } from "../rbac";

// The predicate from before the rules were indexed.
const oldCanListResource = (resourceRules: V1ResourceRule[]) => (resource: KubeApiResource) =>
  resourceRules
    .filter(({ apiGroups = ["*"] }) => apiGroups.includes("*") || apiGroups.includes(resource.group))
    .filter(({ resources = ["*"] }) => resources.includes("*") || resources.includes(resource.apiName))
    .some(({ verbs }) => verbs.includes("*") || verbs.includes("list"));

const resource = (group: string, apiName: string) => ({ group, apiName }) as KubeApiResource;

describe("createCanListResource", () => {
  it("handles wildcards, the core group and verbs", () => {
    const can = createCanListResource([
      { verbs: ["get"], apiGroups: ["*"], resources: ["*"] },
      { verbs: ["list"], apiGroups: [""], resources: ["pods"] },
      { verbs: ["*"], apiGroups: ["apps"], resources: ["*"] },
      { verbs: ["watch", "list"], resources: ["nodes"] },
    ]);

    expect(can(resource("", "pods"))).toBe(true);
    expect(can(resource("", "secrets"))).toBe(false);
    expect(can(resource("apps", "deployments"))).toBe(true);
    expect(can(resource("batch", "jobs"))).toBe(false);
    expect(can(resource("anything", "nodes"))).toBe(true);
    expect(createCanListResource([])(resource("", "pods"))).toBe(false);
  });

  it("fails on a rule without verbs exactly where the previous implementation did", () => {
    const rules = [
      { apiGroups: [""], resources: ["pods"] },
      { verbs: ["list"], apiGroups: ["apps"], resources: ["*"] },
    ] as unknown as V1ResourceRule[];
    const can = createCanListResource(rules);
    const old = oldCanListResource(rules);

    expect(can(resource("apps", "deployments"))).toBe(old(resource("apps", "deployments")));
    expect(() => old(resource("", "pods"))).toThrow(TypeError);
    expect(() => can(resource("", "pods"))).toThrow(TypeError);
  });

  it("gives the same answer as the previous implementation for random rules", () => {
    let seed = 987654321;
    const rnd = (n: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;

      return (seed >> 8) % n;
    };
    const groups = ["", "apps", "batch", "*", "x.io"];
    const names = ["pods", "nodes", "jobs", "*", "crds", ""];
    const verbs = ["get", "list", "watch", "*", "create"];
    const subset = (all: string[], optional: boolean) =>
      optional && rnd(4) === 0 ? undefined : Array.from({ length: rnd(4) }, () => all[rnd(all.length)]);

    for (let round = 0; round < 300; round += 1) {
      const rules: V1ResourceRule[] = Array.from({ length: rnd(7) }, () => ({
        apiGroups: subset(groups, true),
        resources: subset(names, true),
        verbs: subset(verbs, false) as string[],
      }));
      const oldFn = oldCanListResource(rules);
      const newFn = createCanListResource(rules);

      for (const group of groups) {
        for (const apiName of names) {
          expect(newFn(resource(group, apiName))).toBe(oldFn(resource(group, apiName)));
        }
      }
    }
  });
});
