/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observable } from "mobx";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClusterFrameHandler } from "../../../renderer/components/cluster-manager/cluster-frame-handler";

const makeCluster = (id: string) => ({
  id,
  contextName: observable.box("ctx"),
  ready: observable.box(true),
  available: observable.box(true),
  disconnected: observable.box(false),
});

describe("replacing the frame of a cluster whose process is gone", () => {
  let handler: ClusterFrameHandler;
  let removed: string[];
  const clusters = new Map(["a", "b"].map((id) => [id, makeCluster(id)]));

  const frameOf = (id: string) => document.getElementById(`cluster-frame-${id}`) as HTMLIFrameElement | null;

  const startFrame = (id: string) => {
    handler.initView(id);
    frameOf(id)?.dispatchEvent(new Event("load"));
  };

  beforeEach(() => {
    removed = [];
    document.body.innerHTML = '<div id="lens-views"></div>';
    handler = new ClusterFrameHandler({
      logger: { info: vi.fn(), warn: vi.fn() } as never,
      getClusterById: ((id: string) => clusters.get(id)) as never,
      emitClusterVisibility: vi.fn(),
      emitShownClusters: vi.fn(),
      emitFrameRemoved: (id) => removed.push(id),
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("does nothing for a cluster without a loaded frame", () => {
    expect(handler.restartView("a")).toBe(false);

    handler.initView("a");

    expect(handler.restartView("a")).toBe(false);
    expect(frameOf("a")).not.toBeNull();
  });

  it("removes the frame of a hidden cluster at once and leaves the new one until the cluster is shown", () => {
    startFrame("a");
    const dead = frameOf("a");

    expect(handler.restartView("a")).toBe(true);

    expect(dead?.isConnected).toBe(false);
    expect(frameOf("a")).toBeNull();
    expect(handler.hasLoadedView("a")).toBe(false);
    expect(removed).toEqual(["a"]);
  });

  it("starts a new frame at once for a cluster that is shown, and shows it when it has loaded", () => {
    startFrame("a");
    handler.setVisibleCluster("a");
    const dead = frameOf("a");

    handler.restartView("a");

    const replacement = frameOf("a");

    expect(replacement).not.toBeNull();
    expect(replacement).not.toBe(dead);
    expect(dead?.isConnected).toBe(false);

    replacement?.dispatchEvent(new Event("load"));

    expect(replacement?.classList.contains("hidden")).toBe(false);
  });

  it("puts a replaced frame of a multiview back in its pane", () => {
    startFrame("a");
    startFrame("b");
    handler.setVisibleClusters(
      [
        { clusterId: "a", rect: { left: 0, top: 0, width: 50, height: 100 } },
        { clusterId: "b", rect: { left: 50, top: 0, width: 50, height: 100 } },
      ],
      20,
    );

    handler.restartView("b");
    const replacement = frameOf("b");

    replacement?.dispatchEvent(new Event("load"));

    expect(replacement?.classList.contains("hidden")).toBe(false);
    expect(replacement?.style.left).toContain("50%");
    expect(frameOf("a")?.classList.contains("hidden")).toBe(false);
  });
});
