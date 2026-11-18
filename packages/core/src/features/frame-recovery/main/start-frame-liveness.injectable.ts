/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { afterApplicationIsLoadedInjectionToken } from "@freelensapp/application";
import { sendMessageToChannelInjectionToken } from "@freelensapp/messaging";
import { getInjectable } from "@ogre-tools/injectable";
import { runInAction } from "mobx";
import clusterFramesInjectable from "../../../common/cluster-frames.injectable";
import { clusterFrameGoneChannel } from "../common/channels";
import { FrameLiveness } from "./frame-liveness";
import isFrameAliveInjectable from "./is-frame-alive.injectable";

export const frameLivenessIntervalMs = 2000;

/**
 * Watches the cluster frames for a renderer process that has crashed or been
 * killed, and tells the window, which replaces the frame.
 */
const startFrameLivenessInjectable = getInjectable({
  id: "frame-recovery-start-frame-liveness",
  instantiate: (di) => ({
    run: () => {
      const clusterFrames = di.inject(clusterFramesInjectable);
      const send = di.inject(sendMessageToChannelInjectionToken);
      const isFrameAlive = di.inject(isFrameAliveInjectable);

      const liveness = new FrameLiveness({
        getFrames: () => clusterFrames.entries(),
        isAlive: ({ processId, frameId }) => isFrameAlive(processId, frameId),
        forget: (clusterId) => runInAction(() => clusterFrames.delete(clusterId)),
        onGone: (clusterId) => send(clusterFrameGoneChannel, { clusterId }),
      });

      setInterval(() => liveness.check(), frameLivenessIntervalMs).unref();
    },
  }),
  injectionToken: afterApplicationIsLoadedInjectionToken,
});

export default startFrameLivenessInjectable;
