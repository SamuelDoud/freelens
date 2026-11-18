/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

const megabyte = 1024 * 1024;

// V8's default old-space limit is a quarter of the physical memory, so a
// machine with 8 GiB gets 2 GiB. The cluster frames share one renderer
// process unless each has its own (the preference "Run each cluster in its own
// process", on by default), and a large cluster (100k pods and their derived
// data) can need more than that and end in an out-of-memory crash with memory
// to spare. Each renderer process gets the limit.
//
// The ceiling is not ours to raise: Electron's V8 keeps its heap in a 4 GiB
// cage, and a larger value is clamped (measured: `--max-old-space-size` of
// 4096, 6000 and 8192 all give a renderer `jsHeapSizeLimit` of 3586 MB). On a
// machine with 16 GiB or more the default is already that ceiling, so this
// only changes anything below it.
const minimumHeapMegabytes = 2048;
const maximumHeapMegabytes = 4096;

/**
 * The old-space limit, in megabytes: half of the physical memory, never below
 * V8's usual floor, and no more than the cage holds.
 */
export const getHeapLimitMegabytes = (totalMemoryBytes: number): number =>
  Math.min(maximumHeapMegabytes, Math.max(minimumHeapMegabytes, Math.floor(totalMemoryBytes / megabyte / 2)));

/**
 * The value of the `js-flags` switch with the heap limit added, or the
 * existing value untouched when it already sets one (a user's own flag wins).
 */
export const withHeapLimit = (existingJsFlags: string, totalMemoryBytes: number): string => {
  if (/--max[-_]old[-_]space[-_]size/.test(existingJsFlags)) {
    return existingJsFlags;
  }

  const limit = `--max-old-space-size=${getHeapLimitMegabytes(totalMemoryBytes)}`;

  return existingJsFlags ? `${existingJsFlags} ${limit}` : limit;
};
