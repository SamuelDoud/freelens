/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getMessageChannelListenerInjectable } from "@freelensapp/messaging";
import currentlyInClusterFrameInjectable from "../../../renderer/routes/currently-in-cluster-frame.injectable";
import { clusterViewStateChannel } from "../common/channels";
import historyControllerInjectable from "./history-controller.injectable";
import timelineInjectable from "./timeline.injectable";

/** Records what a cluster's view shows as a step, when the main frame shows that cluster. */
const clusterViewStateListenerInjectable = getMessageChannelListenerInjectable({
  id: "history-cluster-view-state",
  channel: clusterViewStateChannel,
  getHandler: (di) => {
    const inClusterFrame = di.inject(currentlyInClusterFrameInjectable);

    return ({ clusterId, state }) => {
      if (inClusterFrame) {
        return;
      }

      const timeline = di.inject(timelineInjectable);
      const controller = di.inject(historyControllerInjectable);
      const current = timeline.current;

      controller.lastKnown.set(clusterId, state);

      if (current?.clusterId !== clusterId) {
        return;
      }

      // The first report of a page that was just opened completes its step.
      timeline.record({ ...current, cluster: state }, { replace: !current.cluster || controller.isRestoring() });
    };
  },
});

export default clusterViewStateListenerInjectable;
