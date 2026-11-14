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
}

const historyControllerInjectable = getInjectable({
  id: "history-controller",
  instantiate: (di): HistoryController => {
    const timeline = di.inject(timelineInjectable);
    const navigate = di.inject(navigateInjectable);
    const send = di.inject(sendMessageToChannelInjectionToken);
    const lastKnown = new Map<string, ClusterViewState>();
    let restoringUntil = 0;

    return {
      lastKnown,
      isRestoring: () => Date.now() < restoringUntil,
      go: (delta) => {
        const entry = timeline.go(delta);

        if (!entry) {
          return;
        }

        restoringUntil = Date.now() + restoreSettleMs;

        if (entry.clusterId && entry.cluster) {
          lastKnown.set(entry.clusterId, entry.cluster);
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
