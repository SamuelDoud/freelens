/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { computed, observable, runInAction } from "mobx";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDiForUnitTesting } from "../../../../main/getDiForUnitTesting";
import clustersInjectable from "../../storage/common/clusters.injectable";
import emitClusterStateUpdateInjectable from "./emit-update.injectable";
import setupClusterStateBroadcastingInjectable from "./setup-sync.injectable";

import type { Cluster } from "../../../../common/cluster/cluster";

const clusterOf = (id: string) => {
  const online = observable.box(false);
  const getState = vi.fn(() => ({ online: online.get(), id }));

  return { id, online, getState, cluster: { id, getState } as unknown as Cluster };
};

describe("cluster state broadcasting", () => {
  let list: ReturnType<typeof observable.array<Cluster>>;
  let emit: ReturnType<typeof vi.fn>;
  let run: () => void;

  beforeEach(() => {
    const di = getDiForUnitTesting();

    list = observable.array<Cluster>([], { deep: false });
    emit = vi.fn();
    di.override(clustersInjectable, () => computed(() => [...list]) as any);
    di.override(emitClusterStateUpdateInjectable, () => emit as any);

    run = () => di.inject(setupClusterStateBroadcastingInjectable).run();
  });

  it("emits every cluster once at the start, computing its state once", () => {
    const a = clusterOf("a");
    const b = clusterOf("b");

    list.push(a.cluster, b.cluster);
    run();

    expect(emit.mock.calls.map(([m]) => m.clusterId)).toEqual(["a", "b"]);
    expect(a.getState).toHaveBeenCalledTimes(1);
  });

  it("emits and computes only the cluster that changed, and not for an equal state", () => {
    const a = clusterOf("a");
    const b = clusterOf("b");

    list.push(a.cluster, b.cluster);
    run();
    emit.mockClear();
    a.getState.mockClear();
    b.getState.mockClear();

    runInAction(() => a.online.set(true));

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith({ clusterId: "a", state: { online: true, id: "a" } });
    expect(a.getState).toHaveBeenCalledTimes(1);
    expect(b.getState).not.toHaveBeenCalled();
  });

  it("emits a cluster added later and stops watching a removed one", () => {
    const a = clusterOf("a");

    run();
    list.push(a.cluster);

    expect(emit).toHaveBeenCalledTimes(1);

    list.clear();
    emit.mockClear();
    runInAction(() => a.online.set(true));

    expect(emit).not.toHaveBeenCalled();
  });
});
