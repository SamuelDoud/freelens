/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Agent } from "undici";
import { apiTargetOptions, dispatcherFor } from "../../../main/cluster/freelens-k8s-proxy-target";

import type { ServerOptions } from "http-proxy-3";

const thirtyMinutesInMs = 30 * 60 * 1000;
const fourHoursInMs = 4 * 60 * 60 * 1000;

let dispatcher: ReturnType<typeof dispatcherFor> | undefined;

/**
 * The options for http-proxy-3 to forward a request to the rows service of a
 * cluster on the loopback: plain HTTP, through a pool that sends no hop-by-hop
 * headers and has no body timeout, as the delta stream is quiet when nothing
 * changes.
 */
export const rowsServiceTargetOptions = (port: number, isWatch: boolean): ServerOptions => {
  dispatcher ??= dispatcherFor(new Agent({ bodyTimeout: 0 }));

  return apiTargetOptions({
    target: new URL(`http://127.0.0.1:${port}`),
    dispatcher,
    timeout: isWatch ? fourHoursInMs : thirtyMinutesInMs,
  });
};
