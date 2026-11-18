/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import assert from "node:assert";
import { getInjectable } from "@ogre-tools/injectable";
import clusterFramesInjectable from "../../../common/cluster-frames.injectable";
import { navigateForExtensionChannel } from "../../../features/extensions/navigate/common/channel";
import lastShownClusterFramesInjectable from "../../../features/frame-activity/main/last-shown-cluster-frames.injectable";
import getCurrentApplicationWindowInjectable from "./application-window/get-current-application-window.injectable";
import { findClusterFrame } from "./find-cluster-frame";
import showApplicationWindowInjectable from "./show-application-window.injectable";

import type { NavigateForExtensionArgs } from "../../../features/extensions/navigate/common/channel";

export type NavigateForExtension = (
  extId: string,
  pageId?: string,
  params?: Record<string, any>,
  frameId?: number,
) => Promise<void>;

const navigateForExtensionInjectable = getInjectable({
  id: "navigate-for-extension",

  instantiate: (di): NavigateForExtension => {
    const getApplicationWindow = di.inject(getCurrentApplicationWindowInjectable);
    const clusterFrames = di.inject(clusterFramesInjectable);
    const lastShownClusterFrames = di.inject(lastShownClusterFramesInjectable);
    const showApplicationWindow = di.inject(showApplicationWindowInjectable);

    return async (extId: string, pageId?: string, params?: Record<string, any>, frameId?: number) => {
      await showApplicationWindow();

      const applicationWindow = getApplicationWindow();

      assert(applicationWindow);

      const frameInfo = findClusterFrame(clusterFrames, frameId, lastShownClusterFrames.clusterIds);

      applicationWindow.send({
        channel: navigateForExtensionChannel.id,
        frameInfo,
        data: { extId, pageId, params } as NavigateForExtensionArgs,
      });
    };
  },
});

export default navigateForExtensionInjectable;
