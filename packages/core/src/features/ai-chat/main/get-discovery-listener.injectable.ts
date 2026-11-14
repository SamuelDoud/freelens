/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getRequestChannelListenerInjectable } from "@freelensapp/messaging";
import { getAiDiscoveryChannel } from "../common/channels";
import aiCliDiscoveryInjectable from "./cli-discovery.injectable";

const getAiDiscoveryListenerInjectable = getRequestChannelListenerInjectable({
  id: "ai-chat-get-discovery-listener",
  channel: getAiDiscoveryChannel,
  getHandler: (di) => () => di.inject(aiCliDiscoveryInjectable).get(),
});

export default getAiDiscoveryListenerInjectable;
