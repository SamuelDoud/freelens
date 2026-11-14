/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getMessageChannelListenerInjectable } from "@freelensapp/messaging";
import { runInAction } from "mobx";
import { shownClusterFramesChannel } from "../common/channels";
import shownClusterFramesInjectable from "./shown-cluster-frames.injectable";

const shownClusterFramesListenerInjectable = getMessageChannelListenerInjectable({
  id: "frame-activity-shown-cluster-frames",
  channel: shownClusterFramesChannel,
  getHandler: (di) => (clusterIds) => runInAction(() => di.inject(shownClusterFramesInjectable).set(clusterIds)),
});

export default shownClusterFramesListenerInjectable;
