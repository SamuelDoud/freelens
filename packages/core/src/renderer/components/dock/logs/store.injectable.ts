/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import frameActivityInjectable from "../../../../features/frame-activity/renderer/frame-activity.injectable";
import dockStoreInjectable from "../dock/store.injectable";
import callForLogsInjectable from "./call-for-logs.injectable";
import { LogStore } from "./store";

const logStoreInjectable = getInjectable({
  id: "log-store",

  instantiate: (di) => {
    const frameActivity = di.inject(frameActivityInjectable);
    const dockStore = di.inject(dockStoreInjectable);

    return new LogStore({
      callForLogs: di.inject(callForLogsInjectable),
      isTabSeen: (tabId) => frameActivity.get() && dockStore.isOpen && dockStore.selectedTabId === tabId,
    });
  },
});

export default logStoreInjectable;
