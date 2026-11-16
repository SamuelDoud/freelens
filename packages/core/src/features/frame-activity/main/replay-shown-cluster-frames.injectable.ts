/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getMessageChannelListenerInjectable, sendMessageToChannelInjectionToken } from "@freelensapp/messaging";
import { shownClusterFramesChannel, shownClusterFramesRequestChannel } from "../common/channels";
import lastShownClusterFramesInjectable from "./last-shown-cluster-frames.injectable";

// A frame that starts after the root frame said which clusters are shown has not heard it: it asks, and
// the answer goes to every frame, which each take it as the state they are in anyway.
const replayShownClusterFramesInjectable = getMessageChannelListenerInjectable({
  id: "frame-activity-replay-shown-cluster-frames",
  channel: shownClusterFramesRequestChannel,
  getHandler: (di) => {
    const send = di.inject(sendMessageToChannelInjectionToken);
    const last = di.inject(lastShownClusterFramesInjectable);

    return () => {
      if (last.clusterIds) {
        send(shownClusterFramesChannel, last.clusterIds);
      }
    };
  },
});

export default replayShownClusterFramesInjectable;
