/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observable } from "mobx";
import { describe, expect, it } from "vitest";
import { ClusterManager } from "./manager";

import type { Cluster } from "../../common/cluster/cluster";

class TestManager extends ClusterManager {
  update(clusters: Cluster[]) {
    this.updateCatalog(clusters);
  }

  sync(entities: any[]) {
    this.syncClustersFromCatalog(entities);
  }
}

const entityOf = (id: string, tag = id) => ({
  tag,
  metadata: {},
  spec: { kubeconfigPath: "/kc", kubeconfigContext: tag },
  status: {} as Record<string, unknown>,
  getId: () => id,
  getName: () => tag,
});

const clusterOf = (id: string) =>
  ({
    id,
    accessible: observable.box(true),
    disconnected: observable.box(false),
    kubeConfigPath: observable.box(""),
    contextName: observable.box(""),
    accessibleNamespaces: observable.array<string>([]),
    preferences: {},
  }) as unknown as Cluster;

const setup = (items: any[], existing: Cluster[] = []) => {
  const calls: string[] = [];
  const added: string[] = [];
  const registry = { items, findById: () => undefined };
  const manager = new TestManager({
    catalogEntityRegistry: registry,
    clustersThatAreBeingDeleted: observable.set<string>(),
    visibleCluster: observable.box(null),
    logger: { silly: () => {}, debug: () => {}, info: () => {} },
    clusters: { get: () => existing },
    updateEntityMetadata: (entity: any, cluster: Cluster) => calls.push(`metadata ${entity.tag} ${cluster.id}`),
    updateEntitySpec: (entity: any, cluster: Cluster) => calls.push(`spec ${entity.tag} ${cluster.id}`),
    getClusterConnection: () => {
      throw new Error("unused");
    },
    getClusterById: (id: string) => existing.find((c) => c.id === id),
    addCluster: (c: { id: string }) => added.push(c.id),
  } as any);

  return { manager, calls, added, items };
};

describe("ClusterManager catalog updates", () => {
  it("updates the first entity with the cluster id, in cluster order, and skips unknown clusters", () => {
    const first = entityOf("a", "first-a");
    const items = [entityOf("x"), first, entityOf("a", "second-a"), entityOf("b")];
    const { manager, calls } = setup(items);
    const before = [...items];

    manager.update([clusterOf("b"), clusterOf("missing"), clusterOf("a"), clusterOf("b")]);

    expect(calls).toEqual([
      "metadata b b",
      "spec b b",
      "metadata first-a a",
      "spec first-a a",
      "metadata b b",
      "spec b b",
    ]);
    expect(first.status.phase).toBe("connected");
    expect(items).toEqual(before);
    expect(items.every((item, i) => item === before[i])).toBe(true);
  });

  it("does nothing for an empty catalog", () => {
    const { manager, calls } = setup([]);

    manager.update([clusterOf("a")]);

    expect(calls).toEqual([]);
  });

  it("syncs entities to clusters, adding missing ones and updating known ones in order", () => {
    const known = clusterOf("a");
    const items = [entityOf("b"), entityOf("a", "first-a"), entityOf("a", "second-a"), entityOf("c")];
    const { manager, calls, added } = setup(items, [known]);

    manager.sync([items[2], items[0], items[1], items[3]]);

    expect(added).toEqual(["b", "c"]);
    expect(known.contextName.get()).toBe("first-a");
    expect(calls).toEqual(["metadata first-a a", "spec first-a a", "metadata first-a a", "spec first-a a"]);
  });

  it("follows the registry when it hands out a different items array mid-pass", () => {
    const e1 = entityOf("a", "old-a");
    const e2 = entityOf("a", "new-a");
    const { manager, calls } = setup([entityOf("q"), e1]);
    const registry = (manager as any).dependencies.catalogEntityRegistry;
    const second = [e2, entityOf("z"), entityOf("y")];

    const origUpdate = (manager as any).dependencies.updateEntityMetadata;

    (manager as any).dependencies.updateEntityMetadata = (entity: any, cluster: Cluster) => {
      origUpdate(entity, cluster);
      registry.items = second;
    };

    manager.update([clusterOf("a"), clusterOf("a")]);

    expect(calls).toEqual(["metadata old-a a", "spec old-a a", "metadata new-a a", "spec new-a a"]);
  });
});
