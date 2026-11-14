/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { observable } from "mobx";

/** The clusters whose frames the main frame shows, once it has said; until then, unknown */
const shownClusterFramesInjectable = getInjectable({
  id: "shown-cluster-frames",
  instantiate: () => observable.box<readonly string[] | undefined>(undefined, { deep: false }),
});

export default shownClusterFramesInjectable;
