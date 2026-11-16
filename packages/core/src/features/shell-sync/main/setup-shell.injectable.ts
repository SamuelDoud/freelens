/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { onLoadOfApplicationInjectionToken } from "@freelensapp/application";
import { loggerInjectionToken } from "@freelensapp/logger";
import { unionPATHs } from "@freelensapp/utilities";
import { getInjectable } from "@ogre-tools/injectable";
import isSnapPackageInjectable from "../../../common/vars/is-snap-package.injectable";
import electronAppInjectable from "../../../main/electron-app/electron-app.injectable";
import userShellSettingInjectable from "../../user-preferences/common/shell-setting.injectable";
import computeShellEnvironmentInjectable from "./compute-shell-environment.injectable";
import shellEnvironmentReadyInjectable from "./shell-environment-ready.injectable";
import shellSyncStartupFailureInjectable from "./startup-failure.injectable";

import type { DiContainerForInjection } from "@ogre-tools/injectable";

const setupShellInjectable = getInjectable({
  id: "setup-shell",

  instantiate: (di) => ({
    // Not awaited: a login shell can take seconds to start, and the window
    // need not wait for it. What needs its environment waits for
    // shellEnvironmentReadyInjectable instead.
    run: () => {
      const ready = di.inject(shellEnvironmentReadyInjectable);

      const logger = di.inject(loggerInjectionToken);

      void syncShellEnvironment(di)
        .catch((error) => logger.error(`[SHELL-SYNC]: failed to sync the shell environment`, error))
        .finally(ready.settle);
    },
  }),

  injectionToken: onLoadOfApplicationInjectionToken,
});

const syncShellEnvironment = async (di: DiContainerForInjection) => {
  const logger = di.inject(loggerInjectionToken);
  const isSnapPackage = di.inject(isSnapPackageInjectable);
  const electronApp = di.inject(electronAppInjectable);
  const resolvedUserShellSetting = di.inject(userShellSettingInjectable);
  const computeShellEnvironment = di.inject(computeShellEnvironmentInjectable);
  const shellSyncStartupFailure = di.inject(shellSyncStartupFailureInjectable);

  logger.info("🐚 Syncing shell environment");

  const result = await computeShellEnvironment(resolvedUserShellSetting.get());

  if (!result.callWasSuccessful) {
    logger.error(`[SHELL-SYNC]: ${result.error}`);
    shellSyncStartupFailure.set(result.error);

    return;
  }

  const env = result.response;

  if (!env) {
    logger.debug("[SHELL-SYNC]: nothing to do, env not special in shells");

    return;
  }

  if (!env.LANG) {
    // the LANG env var expects an underscore instead of electron's dash
    env.LANG = `${electronApp.getLocale().replace("-", "_")}.UTF-8`;
  } else if (!env.LANG.endsWith(".UTF-8")) {
    env.LANG += ".UTF-8";
  }

  if (!isSnapPackage) {
    // Prefer the synced PATH over the initial one
    process.env.PATH = unionPATHs(env.PATH ?? "", process.env.PATH ?? "");
  }

  // The spread operator allows joining of objects. The precedence is last to first.
  process.env = {
    ...env,
    ...process.env,
  };

  logger.info(`[SHELL-SYNC]: Synced shell env`);
  logger.silly(
    `[SHELL-SYNC]: updated env`,
    Object.fromEntries(
      Object.keys(process.env)
        .sort()
        .map((key) => [key, process.env[key]]),
    ),
  );
};

export default setupShellInjectable;
