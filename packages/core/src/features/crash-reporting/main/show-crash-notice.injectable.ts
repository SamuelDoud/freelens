/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { loggerInjectionToken } from "@freelensapp/logger";
import { getInjectable } from "@ogre-tools/injectable";
import showMessagePopupInjectable from "../../../main/electron-app/features/show-message-popup.injectable";
import { afterWindowIsOpenedInjectionToken } from "../../../main/start-main-application/runnable-tokens/phases";
import crashStoreInjectable from "./crash-store.injectable";
import openLogsFolderInjectable from "./open-logs-folder.injectable";
import { showCrashNoticeIfNeeded } from "./show-crash-notice";

const showCrashNoticeInjectable = getInjectable({
  id: "show-crash-notice",

  instantiate: (di) => ({
    run: () =>
      showCrashNoticeIfNeeded({
        store: di.inject(crashStoreInjectable),
        showMessagePopup: di.inject(showMessagePopupInjectable),
        openLogsFolder: di.inject(openLogsFolderInjectable),
        logger: di.inject(loggerInjectionToken),
      }),
  }),

  injectionToken: afterWindowIsOpenedInjectionToken,
});

export default showCrashNoticeInjectable;
