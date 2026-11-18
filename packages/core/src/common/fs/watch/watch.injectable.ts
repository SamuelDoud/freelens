/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { watch } from "chokidar";
import platformInjectable from "../../vars/platform.injectable";
import type { Stats } from "node:fs";

import type { SingleOrMany, TypedEventEmitter } from "@freelensapp/utilities";

export type AlwaysStatWatcherEvents = {
  add: (path: string, stats: Stats) => void;
  addDir: (path: string, stats: Stats) => void;
  change: (path: string, stats: Stats) => void;
};

export type MaybeStatWatcherEvents = {
  add: (path: string, stats?: Stats) => void;
  addDir: (path: string, stats?: Stats) => void;
  change: (path: string, stats?: Stats) => void;
};

export type WatcherEvents<AlwaysStat extends boolean> = BaseWatcherEvents &
  (AlwaysStat extends true ? AlwaysStatWatcherEvents : MaybeStatWatcherEvents);

export type BaseWatcherEvents = {
  error: (error: Error) => void;
  ready: () => void;
  unlink: (path: string) => void;
  unlinkDir: (path: string) => void;
};

export interface Watcher<AlwaysStat extends boolean> extends TypedEventEmitter<WatcherEvents<AlwaysStat>> {
  close: () => Promise<void>;
}

export type WatcherOptions<AlwaysStat extends boolean> = {
  /**
   * Indicates whether the process should continue to run as long as files are being watched. If
   * set to `false` when using `fsevents` to watch, no more events will be emitted after `ready`,
   * even if the process continues to run.
   */
  persistent?: boolean;

  /**
   * ([anymatch](https://github.com/micromatch/anymatch)-compatible definition) Defines files/paths to
   * be ignored. The whole relative or absolute path is tested, not just filename. If a function
   * with two arguments is provided, it gets called twice per path - once with a single argument
   * (the path), second time with two arguments (the path and the
   * [`fs.Stats`](https://nodejs.org/api/fs.html#fs_class_fs_stats) object of that path).
   */
  ignored?: SingleOrMany<string | RegExp | ((path: string) => boolean)>;

  /**
   * If set to `false` then `add`/`addDir` events are also emitted for matching paths while
   * instantiating the watching as chokidar discovers these file paths (before the `ready` event).
   */
  ignoreInitial?: boolean;

  /**
   * When `false`, only the symlinks themselves will be watched for changes instead of following
   * the link references and bubbling events through the link's path.
   */
  followSymlinks?: boolean;

  /**
   * The base directory from which watch `paths` are to be derived. Paths emitted with events will
   * be relative to this.
   */
  cwd?: string;

  /**
   * How the file system is observed. `auto` (the default) uses native watching: one recursive
   * `fs.watch` per root on macOS and Windows, one `fs.watch` per directory elsewhere, and a finite
   * `depth` always uses one per directory. `polling` compares `stat` results on a timer, which is
   * what network shares and other file systems that send no change notifications need; it costs
   * CPU and a `stat` per watched file per interval. The environment variable `CHOKIDAR_USEPOLLING`
   * overrides this for the whole process.
   */
  backend?: "auto" | "native" | "native-recursive" | "polling";

  /**
   * If set, limits how many levels of subdirectories will be traversed.
   */
  depth?: number;

  /**
   * Interval of file system polling in milliseconds. Only for `backend: "polling"`.
   */
  pollingInterval?: number;

  /**
   * Interval of file system polling for binary files, in milliseconds. Only for `backend:
   * "polling"`. ([see list of binary extensions](https://github.com/sindresorhus/binary-extensions/blob/master/binary-extensions.json))
   */
  pollingBinaryInterval?: number;

  /**
   *  Indicates whether to watch files that don't have read permissions if possible. If watching
   *  fails due to `EPERM` or `EACCES` with this set to `true`, the errors will be suppressed
   *  silently.
   */
  ignorePermissionErrors?: boolean;

  /**
   * `true` unless polling, `false` with it. Automatically filters out artifacts
   * that occur when using editors that use "atomic writes" instead of writing directly to the
   * source file. If a file is re-added within 100 ms of being deleted, Chokidar emits a `change`
   * event rather than `unlink` then `add`. If the default of 100 ms does not work well for you,
   * you can override it by setting `atomic` to a custom value, in milliseconds.
   */
  atomic?: boolean | number;

  /**
   * can be set to an object in order to adjust timing params:
   */
  awaitWriteFinish?: AwaitWriteFinishOptions | boolean;
} & (AlwaysStat extends true
  ? {
      alwaysStat: true;
    }
  : {
      alwaysStat?: false;
    });

export interface AwaitWriteFinishOptions {
  /**
   * Amount of time in milliseconds for a file size to remain constant before emitting its event.
   */
  stabilityThreshold?: number;

  /**
   * File size polling interval.
   */
  pollInterval?: number;
}

export type Watch = <AlwaysStat extends boolean = false>(
  path: SingleOrMany<string>,
  options?: WatcherOptions<AlwaysStat>,
) => Watcher<AlwaysStat>;

export const macOsPollingInterval = 1000;

/**
 * The options a watcher gets on a platform. On macOS a watcher polls unless its caller asks for
 * native watching by name (`backend: "native"` or `"native-recursive"`).
 *
 * libuv serves `fs.watch` of a file on macOS with kqueue, and aborts the whole process when it
 * cannot re-arm such a watch, which happens when the file's volume goes away: a disk image or USB
 * drive ejected, or a network share (NFS, SMB) that goes stale across sleep or a network change.
 * Chokidar 6 still watches a single file that way (a kubeconfig file synced on its own), and the
 * application aborted with it overnight on a Mac syncing a kubeconfig on an NFS home. Polling
 * reads `stat` and never arms a kqueue watch, so nothing can abort.
 */
export function watchOptionsFor<AlwaysStat extends boolean>(
  platform: string,
  options?: WatcherOptions<AlwaysStat>,
): WatcherOptions<AlwaysStat> | undefined {
  if (platform !== "darwin" || (options?.backend !== undefined && options.backend !== "auto")) {
    return options;
  }

  return {
    ...options,
    backend: "polling",
    pollingInterval: options?.pollingInterval ?? macOsPollingInterval,
    pollingBinaryInterval: options?.pollingBinaryInterval ?? macOsPollingInterval,
  } as WatcherOptions<AlwaysStat>;
}

// TODO: Introduce wrapper to allow simpler API
const watchInjectable = getInjectable({
  id: "watch",
  instantiate: (di): Watch => {
    const platform = di.inject(platformInjectable);

    return (path, options) => watch(path, watchOptionsFor(platform, options) as never) as never;
  },
  causesSideEffects: true,
});

export default watchInjectable;
