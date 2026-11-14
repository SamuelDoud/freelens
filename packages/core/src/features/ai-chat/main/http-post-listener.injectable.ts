/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getRequestChannelListenerInjectable } from "@freelensapp/messaging";
import { aiHttpPostChannel } from "../common/channels";
import { aiHttpRequest } from "./http-request";

// An OpenAI-compatible server at a URL is called from here: the cluster frame's content security
// policy keeps it from reaching other origins.
const aiHttpPostListenerInjectable = getRequestChannelListenerInjectable({
  id: "ai-chat-http-post-listener",
  channel: aiHttpPostChannel,
  getHandler:
    () =>
    ({ url, body, timeoutMs }) =>
      aiHttpRequest(
        url,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
        timeoutMs,
      ),
});

export default aiHttpPostListenerInjectable;
