/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import currentlyInClusterFrameInjectable from "../../../renderer/routes/currently-in-cluster-frame.injectable";
import { Timeline } from "../common/timeline";
import clusterViewStateListenerInjectable from "./cluster-view-state-listener.injectable";
import historyControllerInjectable from "./history-controller.injectable";
import timelineInjectable from "./timeline.injectable";

import type { DiContainerForInjection } from "@ogre-tools/injectable";

import type { ClusterViewState } from "../common/channels";

const view = (path: string, scrollTop = 0): ClusterViewState => ({ path, namespaces: [], expanded: {}, scrollTop });

describe("cluster view state listener in a multiview", () => {
  const setup = () => {
    const timeline = new Timeline();
    const controller = { lastKnown: new Map<string, ClusterViewState>(), isRestoring: () => false };
    const di = {
      inject: (injectable: unknown) =>
        injectable === currentlyInClusterFrameInjectable
          ? false
          : injectable === timelineInjectable
            ? timeline
            : injectable === historyControllerInjectable
              ? controller
              : undefined,
    } as unknown as DiContainerForInjection;
    const { handler } = clusterViewStateListenerInjectable.instantiate(di as never);

    timeline.record({ rootPath: "/multiview/m1" });

    return { timeline, report: (clusterId: string, state: ClusterViewState) => handler({ clusterId, state }) };
  };

  it("takes one step for the opening of all its panes", () => {
    const { timeline, report } = setup();

    report("a", view("/pods"));
    report("b", view("/pods"));
    report("c", view("/nodes"));

    expect(timeline.entries).toHaveLength(1);
  });

  it("takes a step when a pane other than the current one moves to another view", () => {
    const { timeline, report } = setup();

    report("a", view("/pods"));
    report("b", view("/pods"));
    report("b", view("/nodes"));

    expect(timeline.entries.map((entry) => entry.clusterId)).toEqual(["a", "b"]);
  });
});
