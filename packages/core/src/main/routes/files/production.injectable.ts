/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import path from "node:path";
import { prefixedLoggerInjectable } from "@freelensapp/logger";
import { getInjectable } from "@ogre-tools/injectable";
import readFileBufferInjectable from "../../../common/fs/read-file-buffer.injectable";
import joinPathsInjectable from "../../../common/path/join-paths.injectable";
import staticFilesDirectoryInjectable from "../../../common/vars/static-files-directory.injectable";
import { contentTypes } from "../../router/router-content-types";

import type { LensApiRequest } from "../../router/route";

/**
 * The bundler names every file under `build/assets/` after a hash of its
 * content (`index-D0VLV1RL.js`), so a name never refers to two different
 * contents and the browser may keep the file, and the code it compiled from
 * it, for good. `index.html` and everything else carries no such name and is
 * sent without cache headers, as before.
 */
const hashedAssetPath = /^\/build\/assets\/[^/]+-[A-Za-z0-9_-]{8}\.[A-Za-z0-9]+$/;

const immutableCacheControl = "public, max-age=31536000, immutable";

const prodStaticFileRouteHandlerInjectable = getInjectable({
  id: "prod-static-file-route-handler",
  instantiate: (di) => {
    const readFileBuffer = di.inject(readFileBufferInjectable);
    const joinPaths = di.inject(joinPathsInjectable);
    const staticFilesDirectory = di.inject(staticFilesDirectoryInjectable);
    const logger = di.inject(prefixedLoggerInjectable, "FILE-ROUTE");

    return async ({ params }: LensApiRequest<"/{path*}">) => {
      const filePath =
        !params.path || params.path === "/"
          ? "/build/index.html"
          : path.posix.extname(params.path)
            ? params.path
            : "/build/index.html";

      const assetFilePath = joinPaths(staticFilesDirectory, filePath);

      if (!assetFilePath.startsWith(staticFilesDirectory)) {
        return { statusCode: 404 };
      }

      const fileExtension = path.extname(assetFilePath).slice(1);
      const contentType = contentTypes[fileExtension] || contentTypes.txt;

      try {
        const response = await readFileBuffer(assetFilePath);

        return hashedAssetPath.test(filePath)
          ? { response, contentType, headers: { "Cache-Control": immutableCacheControl } }
          : { response, contentType };
      } catch (err) {
        logger.error(`failed to find file "${filePath}"`, err);

        return { statusCode: 404 };
      }
    };
  },
});

export default prodStaticFileRouteHandlerInjectable;
