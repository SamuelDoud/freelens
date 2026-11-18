/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { requestFromChannelInjectionToken } from "@freelensapp/messaging";
import { getInjectable } from "@ogre-tools/injectable";
import { rendererMemoryChannel } from "../common/channels";

/**
 * What the renderer processes take together, as of the last time it was asked
 * for. The answer comes from the main process, so it is asked for in the
 * background and the one from the time before is used; it is only for a limit
 * checked every half minute. Undefined while there is one renderer process,
 * where the heap of this one is what counts.
 */
const rendererMemoryInjectable = getInjectable({
  id: "frame-recovery-renderer-memory",
  instantiate: (di) => {
    const request = di.inject(requestFromChannelInjectionToken);
    let latest: number | undefined;

    return () => {
      request(rendererMemoryChannel)
        .then(({ totalBytes, processes }) => {
          latest = processes > 1 ? totalBytes : undefined;
        })
        .catch(() => {
          latest = undefined;
        });

      return latest;
    };
  },
});

export default rendererMemoryInjectable;
