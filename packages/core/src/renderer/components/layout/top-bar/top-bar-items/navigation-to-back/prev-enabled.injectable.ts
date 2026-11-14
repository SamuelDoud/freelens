/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import timelineInjectable from "../../../../../../features/history/renderer/timeline.injectable";

const topBarPrevEnabledInjectable = getInjectable({
  id: "top-bar-prev-enabled",
  instantiate: (di) => {
    const timeline = di.inject(timelineInjectable);

    return computed(() => timeline.index >= 0 && timeline.canGo(-1));
  },
});

export default topBarPrevEnabledInjectable;
