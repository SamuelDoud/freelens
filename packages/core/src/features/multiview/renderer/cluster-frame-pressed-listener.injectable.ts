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
        const pressed = di.inject(pressedClusterFrameInjectable);

        // Cleared first: a press of the frame pressed last must still change the value, after the active pane
        // moved some other way, such as a click on a pane's title.
        runInAction(() => pressed.set(undefined));
        runInAction(() => pressed.set(clusterId));
      }
    };
  },
});

export default clusterFramePressedListenerInjectable;
