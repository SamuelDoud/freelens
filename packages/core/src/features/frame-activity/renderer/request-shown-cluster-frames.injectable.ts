/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { sendMessageToChannelInjectionToken } from "@freelensapp/messaging";
import { getInjectable } from "@ogre-tools/injectable";
import { beforeClusterFrameStartsSecondInjectionToken } from "../../../renderer/before-frame-starts/tokens";
import { shownClusterFramesRequestChannel } from "../common/channels";

/** A cluster frame that starts hidden must not take itself for a shown one: it asks which are shown. */
const requestShownClusterFramesInjectable = getInjectable({
  id: "frame-activity-request-shown-cluster-frames",
  instantiate: (di) => ({
    run: () => di.inject(sendMessageToChannelInjectionToken)(shownClusterFramesRequestChannel),
  }),
  injectionToken: beforeClusterFrameStartsSecondInjectionToken,
});

export default requestShownClusterFramesInjectable;
