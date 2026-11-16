/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { sendMessageToChannelInjectionToken } from "@freelensapp/messaging";
import { getInjectable } from "@ogre-tools/injectable";
import { compareStructural, reaction } from "mobx";
import { beforeClusterFrameStartsSecondInjectionToken } from "../../../renderer/before-frame-starts/tokens";
import hostedClusterIdInjectable from "../../../renderer/cluster-frame-context/hosted-cluster-id.injectable";
import { frameKeepAliveChannel } from "../common/channels";
import frameKeepAliveReasonsInjectable from "./keep-alive-reasons.injectable";

/** Tells the main frame, whenever it changes, what this frame holds that is lost with it. */
const reportKeepAliveInjectable = getInjectable({
  id: "frame-eviction-report-keep-alive",
  instantiate: (di) => ({
    run: () => {
      const clusterId = di.inject(hostedClusterIdInjectable);
      const send = di.inject(sendMessageToChannelInjectionToken);
      const reasons = di.inject(frameKeepAliveReasonsInjectable);

      if (!clusterId) {
        return;
      }

      reaction(
        () => reasons.get(),
        (current) => send(frameKeepAliveChannel, { clusterId, reasons: current }),
        {
          fireImmediately: true,
          equals: compareStructural,
        },
      );
    },
  }),
  injectionToken: beforeClusterFrameStartsSecondInjectionToken,
});

export default reportKeepAliveInjectable;
