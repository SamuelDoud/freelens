/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getRequestChannelListenerInjectable } from "@freelensapp/messaging";
import { listAiChatsChannel } from "../common/channels";
import aiChatHostInjectable from "./chat-host.injectable";

const listAiChatsListenerInjectable = getRequestChannelListenerInjectable({
  id: "ai-chat-list-listener",
  channel: listAiChatsChannel,
  getHandler:
    (di) =>
    ({ clusterId }) =>
      di.inject(aiChatHostInjectable).list(clusterId),
});

export default listAiChatsListenerInjectable;
