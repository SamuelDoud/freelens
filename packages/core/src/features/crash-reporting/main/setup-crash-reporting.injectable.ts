/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { beforeElectronIsReadyInjectionToken } from "@freelensapp/application-for-electron-main";
import { loggerInjectionToken } from "@freelensapp/logger";
import { getInjectable } from "@ogre-tools/injectable";
import electronAppInjectable from "../../../main/electron-app/electron-app.injectable";
import showErrorPopupInjectable from "../../../main/electron-app/features/show-error-popup.injectable";
import crashStoreInjectable from "./crash-store.injectable";
import { setupCrashHandlers } from "./setup-crash-handlers";

const setupCrashReportingInjectable = getInjectable({
  id: "setup-crash-reporting",

  instantiate: (di) => ({
    run: () => {
      setupCrashHandlers({
        store: di.inject(crashStoreInjectable),
        app: di.inject(electronAppInjectable),
        processEvents: process,
        logger: di.inject(loggerInjectionToken),
        showErrorPopup: di.inject(showErrorPopupInjectable),
      });

      return undefined;
    },
  }),

  injectionToken: beforeElectronIsReadyInjectionToken,
});

export default setupCrashReportingInjectable;
