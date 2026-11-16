/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { beforeEach, describe, expect, it } from "vitest";
import readFileBufferInjectable from "../../../common/fs/read-file-buffer.injectable";
import staticFilesDirectoryInjectable from "../../../common/vars/static-files-directory.injectable";
import { getDiForUnitTesting } from "../../getDiForUnitTesting";
import prodStaticFileRouteHandlerInjectable from "./production.injectable";

import type { LensApiRequest } from "../../router/route";

describe("production static files", () => {
  let handle: (request: LensApiRequest<"/{path*}">) => Promise<any>;

  beforeEach(() => {
    const di = getDiForUnitTesting();

    di.override(staticFilesDirectoryInjectable, () => "/static");
    di.override(readFileBufferInjectable, () => async () => Buffer.from("content"));
    handle = di.inject(prodStaticFileRouteHandlerInjectable) as typeof handle;
  });

  const get = (path: string) => handle({ params: { path } } as LensApiRequest<"/{path*}">);

  it.each([
    "/build/assets/index-D0VLV1RL.js",
    "/build/assets/editor.worker-CX7Cj20z.js",
    "/build/assets/a-b_c-Ab-_9Z8y.css",
  ])("lets the browser keep the hashed %s for good", async (path) => {
    expect((await get(path)).headers).toEqual({ "Cache-Control": "public, max-age=31536000, immutable" });
  });

  it.each(["/", "/build/index.html", "/build/main.js", "/build/assets/unhashed.js", "/build/assets/index-short.js"])(
    "sends %s without cache headers",
    async (path) => {
      expect((await get(path)).headers).toBeUndefined();
    },
  );
});
