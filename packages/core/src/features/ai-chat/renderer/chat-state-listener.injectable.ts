/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getMessageChannelListenerInjectable } from "@freelensapp/messaging";
import { aiChatStateChannel } from "../common/channels";
import aiChatMirrorInjectable from "./chat-mirror.injectable";

const aiChatStateListenerInjectable = getMessageChannelListenerInjectable({
  id: "ai-chat-mirror",
  channel: aiChatStateChannel,
  getHandler: (di) => (message) => di.inject(aiChatMirrorInjectable).receive(message),
});

export default aiChatStateListenerInjectable;
