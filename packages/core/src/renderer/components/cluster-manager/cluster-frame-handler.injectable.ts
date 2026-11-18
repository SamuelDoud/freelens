/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { loggerInjectionToken } from "@freelensapp/logger";
import { sendMessageToChannelInjectionToken } from "@freelensapp/messaging";
import { getInjectable } from "@ogre-tools/injectable";
import getClusterByIdInjectable from "../../../features/cluster/storage/common/get-by-id.injectable";
import { shownClusterFramesChannel } from "../../../features/frame-activity/common/channels";
import { clusterFrameRemovedChannel } from "../../../features/frame-recovery/common/channels";
import { ClusterFrameHandler } from "./cluster-frame-handler";
import emitClusterVisibilityInjectable from "./emit-cluster-visibility.injectable";

const clusterFrameHandlerInjectable = getInjectable({
  id: "cluster-frame-handler",
  instantiate: (di) =>
    new ClusterFrameHandler({
      emitClusterVisibility: di.inject(emitClusterVisibilityInjectable),
      emitFrameRemoved: (clusterId) =>
        di.inject(sendMessageToChannelInjectionToken)(clusterFrameRemovedChannel, { clusterId }),
      emitShownClusters: (clusterIds) =>
        di.inject(sendMessageToChannelInjectionToken)(shownClusterFramesChannel, clusterIds),
      getClusterById: di.inject(getClusterByIdInjectable),
      logger: di.inject(loggerInjectionToken),
    }),
});

export default clusterFrameHandlerInjectable;
