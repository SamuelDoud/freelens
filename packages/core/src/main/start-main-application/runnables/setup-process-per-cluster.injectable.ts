/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { beforeElectronIsReadyInjectionToken } from "@freelensapp/application-for-electron-main";
import { getInjectable } from "@ogre-tools/injectable";
import directoryForUserDataInjectable from "../../../common/app-paths/directory-for-user-data/directory-for-user-data.injectable";
import readJsonSyncInjectable from "../../../common/fs/read-json-sync.injectable";
import joinPathsInjectable from "../../../common/path/join-paths.injectable";
import electronAppInjectable from "../../electron-app/electron-app.injectable";
import { readProcessPerClusterPreference, withClusterOriginsIsolated } from "./setup-process-per-cluster";

/**
 * Gives each cluster's frame a renderer process of its own, so that a cluster
 * busy with a large list does not freeze the window or the other clusters, and
 * a hidden cluster works on another core. Costs memory per cluster, so the
 * preference "Run each cluster in its own process" turns it off.
 */
const setupProcessPerClusterInjectable = getInjectable({
  id: "setup-process-per-cluster",

  instantiate: (di) => ({
    run: () => {
      const app = di.inject(electronAppInjectable);
      const readJsonSync = di.inject(readJsonSyncInjectable);
      const joinPaths = di.inject(joinPathsInjectable);
      const userData = di.inject(directoryForUserDataInjectable);

      const enabled = readProcessPerClusterPreference(() => readJsonSync(joinPaths(userData, "lens-user-store.json")));

      if (enabled) {
        app.commandLine.appendSwitch(
          "isolate-origins",
          withClusterOriginsIsolated(app.commandLine.getSwitchValue("isolate-origins") ?? ""),
        );
      }

      return undefined;
    },
  }),

  injectionToken: beforeElectronIsReadyInjectionToken,
});

export default setupProcessPerClusterInjectable;
