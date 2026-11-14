/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observableHistoryInjectionToken } from "@freelensapp/routing";
import { getInjectable } from "@ogre-tools/injectable";
import { reaction } from "mobx";
import { beforeMainFrameStartsSecondInjectionToken } from "../../../renderer/before-frame-starts/tokens";
import historyControllerInjectable from "./history-controller.injectable";
import timelineInjectable from "./timeline.injectable";

export const clusterIdOfPath = (path: string) => /^\/cluster\/([^/]+)/.exec(path)?.[1];

/** Records every page of the main frame as a step, with the view a cluster's page last showed. */
const recordRootHistoryInjectable = getInjectable({
  id: "record-root-history",
  instantiate: (di) => ({
    run: () => {
      const history = di.inject(observableHistoryInjectionToken);
      const timeline = di.inject(timelineInjectable);
      const controller = di.inject(historyControllerInjectable);

      reaction(
        () => history.location.pathname,
        (rootPath) => {
          const clusterId = clusterIdOfPath(rootPath);

          timeline.record(
            { rootPath, clusterId, cluster: clusterId ? controller.lastKnown.get(clusterId) : undefined },
            { replace: controller.isRestoring() },
          );
        },
        { fireImmediately: true },
      );
    },
  }),
  injectionToken: beforeMainFrameStartsSecondInjectionToken,
});

export default recordRootHistoryInjectable;
