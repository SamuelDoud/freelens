/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getMessageChannelListenerInjectable } from "@freelensapp/messaging";
import { aiDiscoveryChangedChannel } from "../common/channels";
import aiDiscoveryMirrorInjectable from "./discovery.injectable";

const aiDiscoveryChangedListenerInjectable = getMessageChannelListenerInjectable({
  id: "ai-discovery-mirror",
  channel: aiDiscoveryChangedChannel,
  getHandler: (di) => (discovery) => di.inject(aiDiscoveryMirrorInjectable).set(discovery),
});

export default aiDiscoveryChangedListenerInjectable;
