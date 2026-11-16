/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { beforeMainFrameStartsSecondInjectionToken } from "../../../renderer/before-frame-starts/tokens";
import frameEvictionInjectable from "./frame-eviction.injectable";

const startFrameEvictionInjectable = getInjectable({
  id: "start-frame-eviction",
  instantiate: (di) => ({
    run: () => di.inject(frameEvictionInjectable).start(),
  }),
  injectionToken: beforeMainFrameStartsSecondInjectionToken,
});

export default startFrameEvictionInjectable;
