/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getRequestChannelListenerInjectable } from "@freelensapp/messaging";
import electronAppInjectable from "../../../main/electron-app/electron-app.injectable";
import { rendererMemoryChannel } from "../common/channels";

/** What the renderer processes hold together, for the limit that unloads hidden clusters. */
const rendererMemoryResponderInjectable = getRequestChannelListenerInjectable({
  id: "frame-recovery-renderer-memory",
  channel: rendererMemoryChannel,
  getHandler: (di) => () => {
    const renderers = di
      .inject(electronAppInjectable)
      .getAppMetrics()
      .filter((metric) => metric.type === "Tab");

    // workingSetSize is in kilobytes
    return {
      totalBytes: renderers.reduce((total, metric) => total + metric.memory.workingSetSize * 1024, 0),
      processes: renderers.length,
    };
  },
});

export default rendererMemoryResponderInjectable;
