/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getMessageChannelListenerInjectable } from "@freelensapp/messaging";
import currentlyInClusterFrameInjectable from "../../../renderer/routes/currently-in-cluster-frame.injectable";
import historyControllerInjectable from "../../history/renderer/history-controller.injectable";
import { viewRestoreRequestChannel } from "../common/channels";

/** A cluster frame that replaces an evicted one is told which view the evicted one showed. */
const restoreRequestListenerInjectable = getMessageChannelListenerInjectable({
  id: "frame-eviction-restore-request",
  channel: viewRestoreRequestChannel,
  getHandler: (di) => {
    const inClusterFrame = di.inject(currentlyInClusterFrameInjectable);

    return ({ clusterId }) => {
      if (!inClusterFrame) {
        di.inject(historyControllerInjectable).restorePending(clusterId);
      }
    };
  },
});

export default restoreRequestListenerInjectable;
