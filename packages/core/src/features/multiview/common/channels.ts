/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getMessageChannel } from "@freelensapp/messaging";

/** A cluster frame was pressed in, so its pane of a multiview is the active one. Relayed by the main process. */
export const clusterFramePressedChannel = getMessageChannel<string>("multiview:cluster-frame-pressed");
