/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { sendMessageToChannelInjectionToken } from "@freelensapp/messaging";
import { getInjectable } from "@ogre-tools/injectable";
import { reaction } from "mobx";
import { beforeClusterFrameStartsSecondInjectionToken } from "../../../renderer/before-frame-starts/tokens";
import { clusterViewStateChannel } from "../common/channels";
import clusterViewSyncInjectable from "./cluster-view-sync.injectable";

/**
 * Tells the main frame what the cluster's view shows whenever that changes:
 * the page, its query, the namespaces, the open rows (once the changes have
 * stopped for a moment, so that typing a search is one step), and the
 * scroll position once scrolling stops.
 */
const reportClusterViewInjectable = getInjectable({
  id: "history-report-cluster-view",
  instantiate: (di) => ({
    run: () => {
      const sync = di.inject(clusterViewSyncInjectable);
      const send = di.inject(sendMessageToChannelInjectionToken);

      if (!sync) {
        return;
      }

      const report = () => {
        if (!sync.isRestoring()) {
          send(clusterViewStateChannel, { clusterId: sync.clusterId, state: sync.read() });
        }
      };

      reaction(
        () => {
          const { path, namespaces, expanded } = sync.read();

          return JSON.stringify([path, namespaces, expanded]);
        },
        report,
        { delay: 600, fireImmediately: true },
      );

      let scrollTimer: ReturnType<typeof setTimeout> | undefined;

      document.addEventListener(
        "scroll",
        () => {
          clearTimeout(scrollTimer);
          scrollTimer = setTimeout(report, 500);
        },
        { capture: true, passive: true },
      );
    },
  }),
  injectionToken: beforeClusterFrameStartsSecondInjectionToken,
});

export default reportClusterViewInjectable;
