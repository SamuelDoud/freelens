/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { sendMessageToChannelInjectionToken } from "@freelensapp/messaging";
import { getInjectable } from "@ogre-tools/injectable";
import { beforeClusterFrameStartsSecondInjectionToken } from "../../../renderer/before-frame-starts/tokens";
import hostedClusterInjectable from "../../../renderer/cluster-frame-context/hosted-cluster.injectable";
import { clusterFramePressedChannel } from "../common/channels";

/** Tells the main frame when the cluster frame is pressed in, for a multiview to make its pane the active one. */
const reportClusterFramePressedInjectable = getInjectable({
  id: "multiview-report-cluster-frame-pressed",
  instantiate: (di) => ({
    run: () => {
      const cluster = di.inject(hostedClusterInjectable);
      const send = di.inject(sendMessageToChannelInjectionToken);

      if (cluster) {
        window.addEventListener("pointerdown", () => send(clusterFramePressedChannel, cluster.id), { capture: true });
      }
    },
  }),
  injectionToken: beforeClusterFrameStartsSecondInjectionToken,
});

export default reportClusterFramePressedInjectable;
