/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { loggerInjectionToken } from "@freelensapp/logger";
import { getInjectable } from "@ogre-tools/injectable";
import applicationMenuItemInjectionToken from "../../application-menu/main/menu-items/application-menu-item-injection-token";
import openLogsFolderInjectable from "./open-logs-folder.injectable";

const openLogsFolderMenuItemInjectable = getInjectable({
  id: "open-logs-folder-menu-item",

  instantiate: (di) => {
    const openLogsFolder = di.inject(openLogsFolderInjectable);
    const logger = di.inject(loggerInjectionToken);

    return {
      kind: "clickable-menu-item" as const,
      parentId: "help",
      id: "open-logs-folder",
      orderNumber: 40,
      label: "Open Logs Folder",

      onClick: () => {
        openLogsFolder().catch((error) => {
          logger.error("[MENU]: failed to open logs folder", { error });
        });
      },
    };
  },

  injectionToken: applicationMenuItemInjectionToken,
});

export default openLogsFolderMenuItemInjectable;
