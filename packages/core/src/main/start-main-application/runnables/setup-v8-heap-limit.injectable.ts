/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import os from "node:os";
import { beforeElectronIsReadyInjectionToken } from "@freelensapp/application-for-electron-main";
import { getInjectable } from "@ogre-tools/injectable";
import electronAppInjectable from "../../electron-app/electron-app.injectable";
import { withHeapLimit } from "./setup-v8-heap-limit";

const setupV8HeapLimitInjectable = getInjectable({
  id: "setup-v8-heap-limit",

  instantiate: (di) => ({
    run: () => {
      const app = di.inject(electronAppInjectable);

      // `js-flags` reaches the renderer process, where the cluster frames
      // live, and the main process alike.
      app.commandLine.appendSwitch(
        "js-flags",
        withHeapLimit(app.commandLine.getSwitchValue("js-flags") ?? "", os.totalmem()),
      );

      return undefined;
    },
  }),

  injectionToken: beforeElectronIsReadyInjectionToken,
});

export default setupV8HeapLimitInjectable;
