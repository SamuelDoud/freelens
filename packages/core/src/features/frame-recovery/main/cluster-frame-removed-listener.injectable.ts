/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getMessageChannelListenerInjectable } from "@freelensapp/messaging";
import { runInAction } from "mobx";
import clusterFramesInjectable from "../../../common/cluster-frames.injectable";
import { clusterFrameRemovedChannel } from "../common/channels";

/** A frame the window has taken out is no longer one to send to, or to look for. */
const clusterFrameRemovedListenerInjectable = getMessageChannelListenerInjectable({
  id: "frame-recovery-cluster-frame-removed",
  channel: clusterFrameRemovedChannel,
  getHandler: (di) => {
    const clusterFrames = di.inject(clusterFramesInjectable);

    return ({ clusterId }) => runInAction(() => clusterFrames.delete(clusterId));
  },
});

export default clusterFrameRemovedListenerInjectable;
