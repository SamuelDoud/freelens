/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getMessageChannelListenerInjectable } from "@freelensapp/messaging";
import { runInAction } from "mobx";
import currentlyInClusterFrameInjectable from "../../../renderer/routes/currently-in-cluster-frame.injectable";
import { clusterFramePressedChannel } from "../common/channels";
import pressedClusterFrameInjectable from "./pressed-cluster-frame.injectable";

const clusterFramePressedListenerInjectable = getMessageChannelListenerInjectable({
  id: "multiview-cluster-frame-pressed",
  channel: clusterFramePressedChannel,
  getHandler: (di) => {
    const inClusterFrame = di.inject(currentlyInClusterFrameInjectable);

    return (clusterId) => {
      if (!inClusterFrame) {
        runInAction(() => di.inject(pressedClusterFrameInjectable).set(clusterId));
      }
    };
  },
});

export default clusterFramePressedListenerInjectable;
