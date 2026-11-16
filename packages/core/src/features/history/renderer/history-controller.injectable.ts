/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { sendMessageToChannelInjectionToken } from "@freelensapp/messaging";
import { getInjectable } from "@ogre-tools/injectable";
import navigateInjectable from "../../../renderer/navigation/navigate.injectable";
import { restoreClusterViewChannel } from "../common/channels";
import timelineInjectable from "./timeline.injectable";

import type { ClusterViewState } from "../common/channels";

/** How long after a step back or forward what the frames report belongs to that step */
const restoreSettleMs = 1500;

export interface HistoryController {
  /** Goes back (negative) or forward (positive) that many steps, restoring what was shown */
  go: (delta: number) => void;
  /** Whether a step back or forward is still settling */
  isRestoring: () => boolean;
  /** The last view each cluster reported */
  readonly lastKnown: Map<string, ClusterViewState>;
  /**
   * The cluster's frame is gone, to be created anew when its cluster is shown
   * again: keeps the view it had, to show again once the new frame is up.
   */
  deferRestore: (clusterId: string) => void;
  /** Shows the view kept for a cluster whose frame has just started anew, if one is kept */
  restorePending: (clusterId: string) => void;
}

const historyControllerInjectable = getInjectable({
  id: "history-controller",
  instantiate: (di): HistoryController => {
    const timeline = di.inject(timelineInjectable);
    const navigate = di.inject(navigateInjectable);
    const send = di.inject(sendMessageToChannelInjectionToken);
    const lastKnown = new Map<string, ClusterViewState>();
    const pending = new Map<string, ClusterViewState>();
    let restoringUntil = 0;

    return {
      lastKnown,
      deferRestore: (clusterId) => {
        const state = lastKnown.get(clusterId);

        if (state) {
          pending.set(clusterId, state);
        }
      },
      restorePending: (clusterId) => {
        const state = pending.get(clusterId);

        if (!state) {
          return;
        }

        pending.delete(clusterId);
        restoringUntil = Date.now() + restoreSettleMs;
        send(restoreClusterViewChannel, { clusterId, state });
      },
      isRestoring: () => Date.now() < restoringUntil,
      go: (delta) => {
        const entry = timeline.go(delta);

        if (!entry) {
          return;
        }

        restoringUntil = Date.now() + restoreSettleMs;

        if (entry.clusterId && entry.cluster) {
          lastKnown.set(entry.clusterId, entry.cluster);

          // A frame that is gone is not there to show the step: the one that replaces it will.
          if (pending.has(entry.clusterId)) {
            pending.set(entry.clusterId, entry.cluster);
          }
        }

        navigate(entry.rootPath);

        if (entry.clusterId && entry.cluster) {
          send(restoreClusterViewChannel, { clusterId: entry.clusterId, state: entry.cluster });
        }
      },
    };
  },
});

export default historyControllerInjectable;
