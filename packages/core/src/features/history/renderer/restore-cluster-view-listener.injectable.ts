/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getMessageChannelListenerInjectable } from "@freelensapp/messaging";
import { restoreClusterViewChannel } from "../common/channels";
import clusterViewSyncInjectable from "./cluster-view-sync.injectable";

/** Shows a view again when the main frame steps back or forward to it. */
const restoreClusterViewListenerInjectable = getMessageChannelListenerInjectable({
  id: "history-restore-cluster-view",
  channel: restoreClusterViewChannel,
  getHandler: (di) => (message) => {
    const sync = di.inject(clusterViewSyncInjectable);

    if (sync && sync.clusterId === message.clusterId) {
      sync.restore(message.state);
    }
  },
});

export default restoreClusterViewListenerInjectable;
