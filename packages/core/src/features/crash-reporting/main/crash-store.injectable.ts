/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { getInjectable } from "@ogre-tools/injectable";
import directoryForLogsInjectable from "../../../common/app-paths/directory-for-logs.injectable";
import getBuildVersionInjectable from "../../../main/electron-app/features/get-build-version.injectable";
import { CrashStore } from "./crash-store";

const crashStoreInjectable = getInjectable({
  id: "crash-store",

  instantiate: (di) =>
    new CrashStore({
      directory: di.inject(directoryForLogsInjectable),
      fs: {
        existsSync,
        mkdirSync: (path, options) => mkdirSync(path, options),
        writeFileSync: (path, data) => writeFileSync(path, data),
        readFileSync: (path, encoding) => readFileSync(path, encoding),
        readdirSync: (path) => readdirSync(path),
        rmSync: (path, options) => rmSync(path, options),
      },
      now: () => new Date(),
      appVersion: di.inject(getBuildVersionInjectable)(),
      versions: {
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        node: process.versions.node,
      },
      platform: `${process.platform} ${process.arch}`,
    }),
});

export default crashStoreInjectable;
