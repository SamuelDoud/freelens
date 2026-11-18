/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getMessageChannel, getRequestChannel } from "@freelensapp/messaging";

/** The main process found the frame of a cluster gone: its renderer process crashed or was killed */
export const clusterFrameGoneChannel = getMessageChannel<{ clusterId: string }>("frame-recovery:cluster-frame-gone");

/** The window took the frame of a cluster out: the main process forgets where it was */
export const clusterFrameRemovedChannel = getMessageChannel<{ clusterId: string }>(
  "frame-recovery:cluster-frame-removed",
);

/** The memory the renderer processes take together, and how many there are */
export const rendererMemoryChannel = getRequestChannel<void, { totalBytes: number; processes: number }>(
  "frame-recovery:renderer-memory",
);
