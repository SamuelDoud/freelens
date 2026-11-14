/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { Timeline } from "../common/timeline";

/** The steps of the window, kept by its main frame */
const timelineInjectable = getInjectable({
  id: "history-timeline",
  instantiate: () => new Timeline(),
});

export default timelineInjectable;
