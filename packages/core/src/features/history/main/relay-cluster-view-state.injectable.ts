/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getMessageChannelListenerInjectable, sendMessageToChannelInjectionToken } from "@freelensapp/messaging";
import { clusterViewStateChannel } from "../common/channels";

// The frames of a window cannot message each other directly: what one sends
// reaches the main process, which passes it on to every frame.
const relayClusterViewStateInjectable = getMessageChannelListenerInjectable({
  id: "history-relay-cluster-view-state",
  channel: clusterViewStateChannel,
  getHandler: (di) => {
    const send = di.inject(sendMessageToChannelInjectionToken);

    return (message) => send(clusterViewStateChannel, message);
  },
});

export default relayClusterViewStateInjectable;
