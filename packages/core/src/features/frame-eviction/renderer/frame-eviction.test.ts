/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observable } from "mobx";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClusterFrameHandler } from "../../../renderer/components/cluster-manager/cluster-frame-handler";
import { restoreClusterViewChannel } from "../../history/common/channels";
import historyControllerInjectable from "../../history/renderer/history-controller.injectable";
import { hiddenFrameEvictionMs } from "../common/eviction-policy";
import { FrameEviction } from "./frame-eviction";

import type { ClusterViewState } from "../../history/common/channels";

const view = (path: string, namespaces: string[] = []): ClusterViewState => ({
  path,
  namespaces,
  expanded: {},
  scrollTop: 0,
});

describe("evicting hidden cluster frames", () => {
  let clock = 1_000_000;
  let handler: ClusterFrameHandler;
  let eviction: FrameEviction;
  let restores: { clusterId: string; state: ClusterViewState }[];
  let history: ReturnType<typeof historyControllerInjectable.instantiate>;
  let heap: number | undefined;

  const makeCluster = () => ({
    id: "",
    contextName: observable.box("ctx"),
    ready: observable.box(true),
    available: observable.box(true),
    disconnected: observable.box(false),
  });

  const clusters = new Map<string, ReturnType<typeof makeCluster>>();

  const startFrame = (clusterId: string) => {
    handler.initView(clusterId);
    document.getElementById(`cluster-frame-${clusterId}`)?.dispatchEvent(new Event("load"));
  };

  /** What a cluster frame does when it starts: reports its first page, then asks to be restored */
  const frameStarted = (clusterId: string) => {
    history.lastKnown.set(clusterId, view("/overview"));
    history.restorePending(clusterId);
  };

  beforeEach(() => {
    clock = 1_000_000;
    heap = undefined;
    restores = [];
    document.body.innerHTML = '<div id="lens-views"></div>';
    clusters.clear();

    for (const id of ["a", "b", "c"]) {
      const cluster = makeCluster();

      cluster.id = id;
      clusters.set(id, cluster);
    }

    handler = new ClusterFrameHandler({
      logger: { info: vi.fn(), warn: vi.fn() } as never,
      getClusterById: ((id: string) => clusters.get(id)) as never,
      emitClusterVisibility: vi.fn(),
      emitShownClusters: vi.fn(),
      now: () => clock,
    });

    // The controller is built on a timeline, navigation and a sender: stand in for those.
    history = historyControllerInjectable.instantiate({
      inject: (token: { id?: string }) =>
        token.id === "history-timeline"
          ? { go: () => undefined }
          : token.id === "navigate"
            ? vi.fn()
            : (message: unknown, payload: { clusterId: string; state: ClusterViewState }) =>
                void (message === restoreClusterViewChannel && restores.push(payload)),
    } as never);

    eviction = new FrameEviction({
      logger: { info: vi.fn() } as never,
      frames: handler,
      deferRestore: history.deferRestore,
      now: () => clock,
      getHeapUsedBytes: () => heap,
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  const show = (id: string | null) => handler.setVisibleCluster(id);

  it("evicts a frame hidden long enough, which then comes back on the same view with the same selection", () => {
    show("a");
    startFrame("a");
    eviction.setKeepAlive("a", []);
    history.lastKnown.set("a", view("/pods?search=nginx", ["kube-system", "default"]));

    show("b");
    startFrame("b");
    eviction.setKeepAlive("b", []);

    clock += hiddenFrameEvictionMs;
    // a has been hidden since b was shown, b is the one shown
    expect(eviction.check()).toEqual(["a"]);
    expect(handler.hasLoadedView("a")).toBe(false);
    expect(document.getElementById("cluster-frame-a")).toBeNull();
    expect(handler.hasLoadedView("b")).toBe(true);

    // back to a: the frame is created again and, once up, is told what to show
    show("a");
    startFrame("a");
    expect(handler.hasLoadedView("a")).toBe(true);
    frameStarted("a");
    expect(restores).toEqual([{ clusterId: "a", state: view("/pods?search=nginx", ["kube-system", "default"]) }]);

    // the view is restored once only
    frameStarted("a");
    expect(restores).toHaveLength(1);
  });

  it("never evicts a frame that is shown", () => {
    show("a");
    startFrame("a");
    eviction.setKeepAlive("a", []);
    clock += hiddenFrameEvictionMs * 3;

    expect(eviction.check()).toEqual([]);
    expect(handler.evictView("a")).toBe(false);
    expect(handler.hasLoadedView("a")).toBe(true);
  });

  it("never evicts a frame in a pane of a multiview", () => {
    handler.setVisibleClusters(
      [
        { clusterId: "a", rect: { left: 0, top: 0, width: 50, height: 100 } },
        { clusterId: "b", rect: { left: 50, top: 0, width: 50, height: 100 } },
      ],
      24,
    );
    startFrame("a");
    startFrame("b");
    eviction.setKeepAlive("a", []);
    eviction.setKeepAlive("b", []);
    clock += hiddenFrameEvictionMs * 3;

    expect(eviction.check()).toEqual([]);
  });

  it.each(["terminal session", "log lines", "unsaved edit", "chat turn running", "port forward"])(
    "never evicts a frame holding: %s",
    (reason) => {
      show("a");
      startFrame("a");
      eviction.setKeepAlive("a", [reason]);
      show(null);

      clock += hiddenFrameEvictionMs * 10;
      heap = Number.MAX_SAFE_INTEGER;

      expect(eviction.check()).toEqual([]);
      expect(handler.hasLoadedView("a")).toBe(true);
    },
  );

  it("evicts it once what it held is gone", () => {
    show("a");
    startFrame("a");
    eviction.setKeepAlive("a", ["terminal session"]);
    show(null);
    clock += hiddenFrameEvictionMs;
    expect(eviction.check()).toEqual([]);

    eviction.setKeepAlive("a", []);
    expect(eviction.check()).toEqual(["a"]);
  });

  it("keeps a frame that has not said what it holds", () => {
    show("a");
    startFrame("a");
    show(null);
    clock += hiddenFrameEvictionMs;

    expect(eviction.check()).toEqual([]);
  });

  it("does not restore a view for a frame that was never evicted", () => {
    show("a");
    startFrame("a");
    frameStarted("a");

    expect(restores).toEqual([]);
  });
});
