/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { beforeApplicationIsLoadingInjectionToken } from "@freelensapp/application";
import { loggerInjectionToken } from "@freelensapp/logger";
import { getInjectable } from "@ogre-tools/injectable";
import { session } from "electron";

/**
 * Empties the origin-bound storage of the session every window uses, before any
 * of them loads. Every page of the renderer, and the extension code it runs,
 * has an origin that carries the port of the proxy. The proxy reuses the port
 * of the previous run when it can, so what an earlier run stored there would be
 * read again; it never was while the port changed on each run, and clearing
 * keeps it that way. The HTTP cache, which the stable origin is there to keep,
 * is not touched.
 */
const clearLocalStorageInjectable = getInjectable({
  id: "clear-local-storage",

  instantiate: (di) => ({
    run: async () => {
      const logger = di.inject(loggerInjectionToken);

      try {
        await session.defaultSession.clearData({
          dataTypes: ["localStorage", "indexedDB", "webSQL", "fileSystems", "serviceWorkers"],
        });
        logger.info("[LOCAL-STORAGE] Cleared the storage of earlier runs");
      } catch (error) {
        logger.error("[LOCAL-STORAGE] Failed to clear the storage of earlier runs", { error });
      }
    },
  }),

  causesSideEffects: true,

  injectionToken: beforeApplicationIsLoadingInjectionToken,
});

export default clearLocalStorageInjectable;
