/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getMessageChannelListenerInjectable } from "@freelensapp/messaging";
import currentlyInClusterFrameInjectable from "../../../renderer/routes/currently-in-cluster-frame.injectable";
import { frameKeepAliveChannel } from "../common/channels";
import frameEvictionInjectable from "./frame-eviction.injectable";

/** The main frame takes note of what each cluster frame says it holds. */
const keepAliveListenerInjectable = getMessageChannelListenerInjectable({
  id: "frame-eviction-keep-alive",
  channel: frameKeepAliveChannel,
  getHandler: (di) => {
    const inClusterFrame = di.inject(currentlyInClusterFrameInjectable);

    return ({ clusterId, reasons }) => {
      if (!inClusterFrame) {
        di.inject(frameEvictionInjectable).setKeepAlive(clusterId, reasons);
      }
    };
  },
});

export default keepAliveListenerInjectable;
