/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getRequestChannelListenerInjectable } from "@freelensapp/messaging";
import { createAiChatChannel } from "../common/channels";
import aiChatHostInjectable from "./chat-host.injectable";
import aiCliDiscoveryInjectable from "./cli-discovery.injectable";
import aiCliHostInjectable from "./cli-host.injectable";

const createAiChatListenerInjectable = getRequestChannelListenerInjectable({
  id: "ai-chat-create-listener",
  channel: createAiChatChannel,
  getHandler: (di) => (request) => {
    const host = di.inject(aiCliHostInjectable)();
    const discovery = di.inject(aiCliDiscoveryInjectable);

    // The CLIs of another host are found when a chat first needs them: connecting then asks for
    // what the host wants, while the user is there to answer.
    if (host.remote && discovery.host !== host.label) {
      void discovery.refresh();
    }

    return di.inject(aiChatHostInjectable).create(request);
  },
});

export default createAiChatListenerInjectable;
