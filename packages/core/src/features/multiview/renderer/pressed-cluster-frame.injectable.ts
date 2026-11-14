/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { observable } from "mobx";

/** The cluster whose frame was pressed in last, for a multiview's active pane */
const pressedClusterFrameInjectable = getInjectable({
  id: "multiview-pressed-cluster-frame",
  instantiate: () => observable.box<string | undefined>(undefined, { deep: false }),
});

export default pressedClusterFrameInjectable;
