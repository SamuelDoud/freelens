/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";

/** What the root frame last said about the clusters shown, for the frames that start after it */
const lastShownClusterFramesInjectable = getInjectable({
  id: "frame-activity-last-shown-cluster-frames",
  instantiate: () => ({ clusterIds: undefined as string[] | undefined }),
});

export default lastShownClusterFramesInjectable;
