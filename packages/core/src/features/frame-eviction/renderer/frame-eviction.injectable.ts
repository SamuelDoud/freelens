/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { loggerInjectionToken } from "@freelensapp/logger";
import { getInjectable } from "@ogre-tools/injectable";
import clusterFrameHandlerInjectable from "../../../renderer/components/cluster-manager/cluster-frame-handler.injectable";
import historyControllerInjectable from "../../history/renderer/history-controller.injectable";
import { FrameEviction } from "./frame-eviction";

const frameEvictionInjectable = getInjectable({
  id: "frame-eviction",
  instantiate: (di) => {
    const history = di.inject(historyControllerInjectable);

    return new FrameEviction({
      logger: di.inject(loggerInjectionToken),
      frames: di.inject(clusterFrameHandlerInjectable),
      deferRestore: history.deferRestore,
      // Only Chromium has it; the limit by heap is left out where it is missing.
      getHeapUsedBytes: () =>
        (globalThis.performance as { memory?: { usedJSHeapSize?: number } }).memory?.usedJSHeapSize,
    });
  },
});

export default frameEvictionInjectable;
