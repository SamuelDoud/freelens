/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getRequestChannelListenerInjectable } from "@freelensapp/messaging";
import { refreshAiDiscoveryChannel } from "../common/channels";
import aiCliDiscoveryInjectable from "./cli-discovery.injectable";

const refreshAiDiscoveryListenerInjectable = getRequestChannelListenerInjectable({
  id: "ai-chat-refresh-discovery-listener",
  channel: refreshAiDiscoveryChannel,
  getHandler: (di) => () => di.inject(aiCliDiscoveryInjectable).refresh(),
});

export default refreshAiDiscoveryListenerInjectable;
