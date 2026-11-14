/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getMessageChannelListenerInjectable, sendMessageToChannelInjectionToken } from "@freelensapp/messaging";
import { historyGoChannel } from "../common/channels";

// The frames of a window cannot message each other directly: what one sends
// reaches the main process, which passes it on to every frame.
const relayHistoryGoInjectable = getMessageChannelListenerInjectable({
  id: "history-relay-go",
  channel: historyGoChannel,
  getHandler: (di) => {
    const send = di.inject(sendMessageToChannelInjectionToken);

    return (delta) => send(historyGoChannel, delta);
  },
});

export default relayHistoryGoInjectable;
