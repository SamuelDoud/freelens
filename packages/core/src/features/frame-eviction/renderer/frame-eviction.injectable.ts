/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { loggerInjectionToken } from "@freelensapp/logger";
import { getInjectable } from "@ogre-tools/injectable";
import clusterFrameHandlerInjectable from "../../../renderer/components/cluster-manager/cluster-frame-handler.injectable";
import rendererMemoryInjectable from "../../frame-recovery/renderer/renderer-memory.injectable";
import historyControllerInjectable from "../../history/renderer/history-controller.injectable";
import userPreferencesStateInjectable from "../../user-preferences/common/state.injectable";
import { FrameEviction } from "./frame-eviction";

const frameEvictionInjectable = getInjectable({
  id: "frame-eviction",
  instantiate: (di) => {
    const history = di.inject(historyControllerInjectable);

    const preferences = di.inject(userPreferencesStateInjectable);
    const rendererMemory = di.inject(rendererMemoryInjectable);

    return new FrameEviction({
      isEnabled: () => preferences.unloadHiddenClusters,
      logger: di.inject(loggerInjectionToken),
      frames: di.inject(clusterFrameHandlerInjectable),
      deferRestore: history.deferRestore,
      // Where the clusters have processes of their own, what the renderer processes take together, as
      // the main process counts it; else the heap of this process, which they share. Only Chromium has
      // the heap; the limit is left out where it is missing.
      getHeapUsedBytes: () =>
        rendererMemory() ?? (globalThis.performance as { memory?: { usedJSHeapSize?: number } }).memory?.usedJSHeapSize,
    });
  },
});

export default frameEvictionInjectable;
