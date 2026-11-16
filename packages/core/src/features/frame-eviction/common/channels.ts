/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getMessageChannel } from "@freelensapp/messaging";

/**
 * A cluster frame says why it must not be evicted: what it holds that the
 * user cannot get back by opening the cluster again. An empty list means that
 * it holds nothing of the kind. Relayed by the main process.
 */
export const frameKeepAliveChannel = getMessageChannel<{ clusterId: string; reasons: string[] }>(
  "frame-eviction:keep-alive",
);

/** A cluster frame that has just started asks the main frame whether it came back from an eviction. Relayed by the main process. */
export const viewRestoreRequestChannel = getMessageChannel<{ clusterId: string }>("frame-eviction:restore-request");
