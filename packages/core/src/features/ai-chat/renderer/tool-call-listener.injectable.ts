/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getMessageChannelListenerInjectable, requestFromChannelInjectionToken } from "@freelensapp/messaging";
import hostedClusterInjectable from "../../../renderer/cluster-frame-context/hosted-cluster.injectable";
import currentlyInClusterFrameInjectable from "../../../renderer/routes/currently-in-cluster-frame.injectable";
import { aiToolCallChannel, aiToolResultChannel } from "../common/channels";
import aiToolExecutorInjectable from "./tool-executor.injectable";

// The tools run in the cluster frame of the chat's cluster: they read that cluster with the user's
// credentials and drive that frame. The chat host has already checked "Allow changes" and approvals.
const aiToolCallListenerInjectable = getMessageChannelListenerInjectable({
  id: "ai-chat",
  channel: aiToolCallChannel,
  getHandler: (di) => {
    const inClusterFrame = di.inject(currentlyInClusterFrameInjectable);
    const requestFromChannel = di.inject(requestFromChannelInjectionToken);

    return async ({ callId, clusterId, name, args, allowChanges }) => {
      // Injected only here: the root frame and the chat window have no cluster to run tools against.
      if (!inClusterFrame || di.inject(hostedClusterInjectable)?.id !== clusterId) {
        return;
      }

      const result = await di.inject(aiToolExecutorInjectable).execute(name, args, {
        allowChanges: () => allowChanges,
        approve: async () => true,
      });

      await requestFromChannel(aiToolResultChannel, { callId, result });
    };
  },
});

export default aiToolCallListenerInjectable;
