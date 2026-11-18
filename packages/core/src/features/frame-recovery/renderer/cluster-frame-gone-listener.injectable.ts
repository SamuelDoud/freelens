/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getMessageChannelListenerInjectable } from "@freelensapp/messaging";
import { showInfoNotificationInjectable } from "@freelensapp/notifications";
import clusterFrameHandlerInjectable from "../../../renderer/components/cluster-manager/cluster-frame-handler.injectable";
import currentlyInClusterFrameInjectable from "../../../renderer/routes/currently-in-cluster-frame.injectable";
import getClusterByIdInjectable from "../../cluster/storage/common/get-by-id.injectable";
import historyControllerInjectable from "../../history/renderer/history-controller.injectable";
import { clusterFrameGoneChannel } from "../common/channels";

/**
 * The window replaces the frame of a cluster whose renderer process has gone,
 * as it does a frame it unloads: the page the cluster showed is kept to show
 * again once the new frame is up, which is at once when the cluster is shown.
 */
const clusterFrameGoneListenerInjectable = getMessageChannelListenerInjectable({
  id: "frame-recovery-cluster-frame-gone",
  channel: clusterFrameGoneChannel,
  getHandler: (di) => {
    const inClusterFrame = di.inject(currentlyInClusterFrameInjectable);

    return ({ clusterId }) => {
      if (inClusterFrame) {
        return;
      }

      const frames = di.inject(clusterFrameHandlerInjectable);

      if (!frames.hasLoadedView(clusterId)) {
        return;
      }

      di.inject(historyControllerInjectable).deferRestore(clusterId);
      frames.restartView(clusterId);

      const name = di.inject(getClusterByIdInjectable)(clusterId)?.name.get() ?? clusterId;

      di.inject(showInfoNotificationInjectable)(`The view of cluster "${name}" stopped working and was restarted.`);
    };
  },
});

export default clusterFrameGoneListenerInjectable;
