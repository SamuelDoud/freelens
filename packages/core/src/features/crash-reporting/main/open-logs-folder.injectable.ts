/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { shell } from "electron";
import directoryForLogsInjectable from "../../../common/app-paths/directory-for-logs.injectable";

export type OpenLogsFolder = () => Promise<void>;

const openLogsFolderInjectable = getInjectable({
  id: "open-logs-folder",

  instantiate: (di): OpenLogsFolder => {
    const directoryForLogs = di.inject(directoryForLogsInjectable);

    return async () => {
      const error = await shell.openPath(directoryForLogs);

      if (error) {
        throw new Error(error);
      }
    };
  },
});

export default openLogsFolderInjectable;
