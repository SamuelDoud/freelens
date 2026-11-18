/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { webFrameMain } from "electron";

/** Whether the frame is still there: its renderer process has not crashed or been killed. */
const isFrameAliveInjectable = getInjectable({
  id: "frame-recovery-is-frame-alive",
  instantiate: () => (processId: number, frameId: number) => {
    try {
      const frame = webFrameMain.fromId(processId, frameId);

      return frame !== undefined && !frame.detached;
    } catch {
      // Electron throws for a frame whose render frame is disposed
      return false;
    }
  },
});

export default isFrameAliveInjectable;
