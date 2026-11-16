/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { sendMessageToChannelInjectionToken } from "@freelensapp/messaging";
import { getInjectable } from "@ogre-tools/injectable";
import { when } from "mobx";
import { beforeClusterFrameStartsSecondInjectionToken } from "../../../renderer/before-frame-starts/tokens";
import hostedClusterIdInjectable from "../../../renderer/cluster-frame-context/hosted-cluster-id.injectable";
import currentRouteComponentInjectable from "../../../renderer/routes/current-route-component.injectable";
import { viewRestoreRequestChannel } from "../common/channels";

/**
 * A frame that starts asks the main frame whether it replaces one that was
 * evicted, and so which view to show. It asks once its first page is up, for
 * the redirect to the start page would otherwise come after the restored view.
 */
const requestViewRestoreInjectable = getInjectable({
  id: "frame-eviction-request-view-restore",
  instantiate: (di) => ({
    run: () => {
      const clusterId = di.inject(hostedClusterIdInjectable);
      const send = di.inject(sendMessageToChannelInjectionToken);
      const route = di.inject(currentRouteComponentInjectable);

      if (!clusterId) {
        return;
      }

      when(
        () => route.get() !== undefined,
        () => send(viewRestoreRequestChannel, { clusterId }),
      );
    },
  }),
  injectionToken: beforeClusterFrameStartsSecondInjectionToken,
});

export default requestViewRestoreInjectable;
