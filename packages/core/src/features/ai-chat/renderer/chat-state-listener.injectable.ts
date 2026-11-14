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
  getHandler: (di) => (snapshot) => di.inject(aiChatMirrorInjectable).update(snapshot),
});

export default aiChatStateListenerInjectable;
