/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed, observable, runInAction } from "mobx";
import hostedClusterIdInjectable from "../../../renderer/cluster-frame-context/hosted-cluster-id.injectable";
import shownClusterFramesInjectable from "./shown-cluster-frames.injectable";

import type { IComputedValue } from "mobx";

/**
 * Whether what this frame shows can be seen: the window is not hidden or
 * minimized, and, for the frame of a cluster, the main frame shows it rather
 * than another cluster's. Work done only for the eye, such as polling metrics
 * or logs, pauses while it is false and catches up when it turns true; the
 * watches that keep the data current go on.
 */
export type FrameActivity = IComputedValue<boolean>;

const frameActivityInjectable = getInjectable({
  id: "frame-activity",
  instantiate: (di): FrameActivity => {
    const hostedClusterId = di.inject(hostedClusterIdInjectable);
    const shownClusterFrames = di.inject(shownClusterFramesInjectable);
    const documentVisible = observable.box(globalThis.document?.visibilityState !== "hidden");

    globalThis.document?.addEventListener("visibilitychange", () =>
      runInAction(() => documentVisible.set(document.visibilityState !== "hidden")),
    );

    return computed(() => {
      if (!documentVisible.get()) {
        return false;
      }

      const shown = shownClusterFrames.get();

      return !hostedClusterId || shown === undefined || shown.includes(hostedClusterId);
    });
  },
});

export default frameActivityInjectable;
