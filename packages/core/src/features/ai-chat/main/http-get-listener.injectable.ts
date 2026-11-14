/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getRequestChannelListenerInjectable } from "@freelensapp/messaging";
import { aiHttpGetChannel } from "../common/channels";
import { aiHttpRequest } from "./http-request";

const aiHttpGetListenerInjectable = getRequestChannelListenerInjectable({
  id: "ai-chat-http-get-listener",
  channel: aiHttpGetChannel,
  getHandler:
    () =>
    ({ url, timeoutMs }) =>
      aiHttpRequest(url, { method: "GET" }, timeoutMs),
});

export default aiHttpGetListenerInjectable;
