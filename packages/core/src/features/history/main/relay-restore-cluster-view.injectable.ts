/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getMessageChannelListenerInjectable, sendMessageToChannelInjectionToken } from "@freelensapp/messaging";
import { restoreClusterViewChannel } from "../common/channels";

// The frames of a window cannot message each other directly: what one sends
// reaches the main process, which passes it on to every frame.
const relayRestoreClusterViewInjectable = getMessageChannelListenerInjectable({
  id: "history-relay-restore-cluster-view",
  channel: restoreClusterViewChannel,
  getHandler: (di) => {
    const send = di.inject(sendMessageToChannelInjectionToken);

    return (message) => send(restoreClusterViewChannel, message);
  },
});

export default relayRestoreClusterViewInjectable;
