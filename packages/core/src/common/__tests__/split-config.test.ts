/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeConfig } from "@kubernetes/client-node";
import { describe, expect, it } from "vitest";
import { splitConfig, validateKubeConfig } from "../kube-helpers";

// The implementation from before the lookups were indexed.
function splitConfigOld(kubeConfig: KubeConfig) {
  return kubeConfig.getContexts().map((ctx) => {
    const config = new KubeConfig();
    const cluster = kubeConfig.getCluster(ctx.cluster);
    const user = kubeConfig.getUser(ctx.user);
    const context = kubeConfig.getContextObject(ctx.name);

    if (cluster) config.addCluster(cluster);
    if (user) config.addUser(user);
    if (context) config.addContext(context);

    config.setCurrentContext(ctx.name);

    return { config, validationResult: validateKubeConfig(config, ctx.name) };
  });
}

const describeResult = (entries: ReturnType<typeof splitConfigOld>) =>
  entries.map(({ config, validationResult }) => ({
    clusters: config.getClusters(),
    users: config.getUsers(),
    contexts: config.getContexts(),
    current: config.getCurrentContext(),
    error: "error" in validationResult ? String(validationResult.error) : undefined,
    hasCluster: "cluster" in validationResult ? Boolean(validationResult.cluster) : undefined,
  }));

const build = (spec: {
  clusters: [string, string][];
  users: [string, string][];
  contexts: [string, string, string][];
}) => {
  const kc = new KubeConfig();

  kc.loadFromOptions({
    clusters: spec.clusters.map(([name, server]) => ({ name, server, skipTLSVerify: false })),
    users: spec.users.map(([name, token]) => ({ name, token })),
    contexts: spec.contexts.map(([name, cluster, user]) => ({ name, cluster, user })),
    currentContext: spec.contexts[0]?.[0],
  });

  return kc;
};

describe("splitConfig", () => {
  it("matches the linear lookups with duplicate names and missing references", () => {
    const kc = build({
      clusters: [
        ["a", "https://a1"],
        ["a", "https://a2"],
        ["b", "https://b"],
      ],
      users: [
        ["u", "t1"],
        ["u", "t2"],
        ["v", "t3"],
      ],
      contexts: [
        ["c1", "a", "u"],
        ["c1", "b", "v"],
        ["c2", "missing", "u"],
        ["c3", "b", "missing"],
        ["c4", "missing", "missing"],
      ],
    });

    expect(describeResult(splitConfig(kc))).toEqual(describeResult(splitConfigOld(kc)));
    expect(splitConfig(kc)).toHaveLength(5);
  });

  it("matches the linear lookups for random configs", () => {
    let seed = 12345;
    const rnd = (n: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;

      return seed % n;
    };

    for (let round = 0; round < 50; round += 1) {
      const names = ["a", "b", "c", "d", "e", "f"];
      const pick = () => names[rnd(names.length)];
      const kc = build({
        clusters: Array.from({ length: rnd(8) }, (_, i) => [pick(), `https://s${i}`] as [string, string]),
        users: Array.from({ length: rnd(8) }, (_, i) => [pick(), `t${i}`] as [string, string]),
        contexts: Array.from({ length: rnd(10) }, () => [pick(), pick(), pick()] as [string, string, string]),
      });

      expect(describeResult(splitConfig(kc))).toEqual(describeResult(splitConfigOld(kc)));
    }
  });

  it("returns nothing for an empty config", () => {
    expect(splitConfig(new KubeConfig())).toEqual([]);
  });
});
