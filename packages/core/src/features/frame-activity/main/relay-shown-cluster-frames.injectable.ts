/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getMessageChannelListenerInjectable, sendMessageToChannelInjectionToken } from "@freelensapp/messaging";
import { shownClusterFramesChannel } from "../common/channels";
import lastShownClusterFramesInjectable from "./last-shown-cluster-frames.injectable";

// The frames of a window cannot message each other directly: what one sends
// reaches the main process, which passes it on to every frame.
const relayShownClusterFramesInjectable = getMessageChannelListenerInjectable({
  id: "frame-activity-relay-shown-cluster-frames",
  channel: shownClusterFramesChannel,
  getHandler: (di) => {
    const send = di.inject(sendMessageToChannelInjectionToken);
    const last = di.inject(lastShownClusterFramesInjectable);

    return (clusterIds) => {
      last.clusterIds = clusterIds;
      send(shownClusterFramesChannel, clusterIds);
    };
  },
});

export default relayShownClusterFramesInjectable;
