/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getMessageChannelListenerInjectable, sendMessageToChannelInjectionToken } from "@freelensapp/messaging";
import { viewRestoreRequestChannel } from "../common/channels";

// The frames of a window cannot message each other directly: what one sends
// reaches the main process, which passes it on to every frame.
const relayRestoreRequestInjectable = getMessageChannelListenerInjectable({
  id: "frame-eviction-relay-restore-request",
  channel: viewRestoreRequestChannel,
  getHandler: (di) => {
    const send = di.inject(sendMessageToChannelInjectionToken);

    return (message) => send(viewRestoreRequestChannel, message);
  },
});

export default relayRestoreRequestInjectable;
