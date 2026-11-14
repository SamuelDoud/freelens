/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getMessageChannelListenerInjectable, sendMessageToChannelInjectionToken } from "@freelensapp/messaging";
import { clusterFramePressedChannel } from "../common/channels";

// The frames of a window cannot message each other directly: what one sends
// reaches the main process, which passes it on to every frame.
const relayClusterFramePressedInjectable = getMessageChannelListenerInjectable({
  id: "multiview-relay-cluster-frame-pressed",
  channel: clusterFramePressedChannel,
  getHandler: (di) => {
    const send = di.inject(sendMessageToChannelInjectionToken);

    return (clusterId) => send(clusterFramePressedChannel, clusterId);
  },
});

export default relayClusterFramePressedInjectable;
