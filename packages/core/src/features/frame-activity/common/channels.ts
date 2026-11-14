/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getMessageChannel } from "@freelensapp/messaging";

/** The clusters whose frames the main frame shows now. Relayed by the main process to every frame. */
export const shownClusterFramesChannel = getMessageChannel<string[]>("frame-activity:shown-cluster-frames");
