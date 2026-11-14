/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import historyControllerInjectable from "../../../../../../../features/history/renderer/history-controller.injectable";

/** Steps forward through the timeline of the window, between pages and within them */
const goForwardInjectable = getInjectable({
  id: "go-forward",
  instantiate: (di) => () => di.inject(historyControllerInjectable).go(1),
});

export default goForwardInjectable;
