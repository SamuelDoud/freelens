/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getMessageChannelListenerInjectable } from "@freelensapp/messaging";
import currentlyInClusterFrameInjectable from "../../../renderer/routes/currently-in-cluster-frame.injectable";
import { historyGoChannel } from "../common/channels";
import historyControllerInjectable from "./history-controller.injectable";

/** Steps back or forward when the menu, a shortcut or a cluster frame asks to. */
const historyGoListenerInjectable = getMessageChannelListenerInjectable({
  id: "history-go",
  channel: historyGoChannel,
  getHandler: (di) => {
    const inClusterFrame = di.inject(currentlyInClusterFrameInjectable);

    return (delta) => {
      if (!inClusterFrame) {
        di.inject(historyControllerInjectable).go(delta);
      }
    };
  },
});

export default historyGoListenerInjectable;
