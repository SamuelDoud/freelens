/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import directoryForUserDataInjectable from "../../common/app-paths/directory-for-user-data/directory-for-user-data.injectable";
import readFileInjectable from "../../common/fs/read-file.injectable";
import writeFileInjectable from "../../common/fs/write-file.injectable";
import joinPathsInjectable from "../../common/path/join-paths.injectable";

export interface FreelensProxyPreferredPort {
  /** The port the proxy listened on last time, if there is one. */
  get: () => Promise<number | undefined>;
  save: (port: number) => Promise<void>;
}

/**
 * The window loads from `https://renderer.freelens.app:<port>`, and Chromium
 * keys its HTTP and code caches by that URL. A port picked by the OS on every
 * run gives every run a new origin and an empty cache, so the proxy first tries
 * the port of the previous run, which this remembers in the user data folder.
 */
const freelensProxyPreferredPortInjectable = getInjectable({
  id: "freelens-proxy-preferred-port",

  instantiate: (di): FreelensProxyPreferredPort => {
    const readFile = di.inject(readFileInjectable);
    const writeFile = di.inject(writeFileInjectable);
    const joinPaths = di.inject(joinPathsInjectable);
    const filePath = joinPaths(di.inject(directoryForUserDataInjectable), "freelens-proxy-port");

    return {
      get: async () => {
        try {
          const port = Number((await readFile(filePath)).trim());

          return Number.isInteger(port) && port >= 1024 && port <= 65535 ? port : undefined;
        } catch {
          return undefined;
        }
      },
      save: async (port) => {
        await writeFile(filePath, String(port)).catch(() => {});
      },
    };
  },

  causesSideEffects: true,
});

export default freelensProxyPreferredPortInjectable;
