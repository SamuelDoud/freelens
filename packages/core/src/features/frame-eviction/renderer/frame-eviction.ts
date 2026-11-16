/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { evictionCheckIntervalMs, pickFramesToEvict } from "../common/eviction-policy";

import type { Logger } from "@freelensapp/logger";

import type { HiddenView } from "../../../renderer/components/cluster-manager/cluster-frame-handler";

export interface FrameEvictionDependencies {
  readonly logger: Logger;
  readonly frames: {
    getHiddenViews: () => HiddenView[];
    evictView: (clusterId: string) => boolean;
  };
  /** Keeps the view of a cluster to show again when its frame has been replaced */
  deferRestore: (clusterId: string) => void;
  now?: () => number;
  /** The heap in use in the renderer process, where the platform says */
  getHeapUsedBytes?: () => number | undefined;
}

/**
 * Unloads the frames of clusters that are not shown, when they have been
 * hidden long enough or there are too many, or the renderer takes too much
 * memory. A frame is unloaded only when it has said that it holds nothing
 * the user could not get back; a frame that has not said so yet is kept.
 */
export class FrameEviction {
  private readonly keepAlive = new Map<string, readonly string[]>();
  private timer?: ReturnType<typeof setInterval>;

  constructor(private readonly dependencies: FrameEvictionDependencies) {}

  /** What a frame has told about what it holds that is lost with it */
  setKeepAlive(clusterId: string, reasons: readonly string[]) {
    this.keepAlive.set(clusterId, reasons);
  }

  /** Looks at the hidden frames once, and unloads those the limits ask for. Returns the clusters unloaded. */
  check(): string[] {
    const now = (this.dependencies.now ?? Date.now)();
    const hidden = this.dependencies.frames.getHiddenViews().map(({ clusterId, hiddenSince }) => ({
      clusterId,
      hiddenSince,
      protectedBy: this.keepAlive.get(clusterId) ?? ["not yet reported"],
    }));

    const evicted: string[] = [];

    for (const clusterId of pickFramesToEvict({
      hidden,
      now,
      heapUsedBytes: this.dependencies.getHeapUsedBytes?.(),
    })) {
      if (this.dependencies.frames.evictView(clusterId)) {
        // Kept before the new frame starts, whose report of its first page would replace it.
        this.dependencies.deferRestore(clusterId);
        this.keepAlive.delete(clusterId);
        evicted.push(clusterId);
      }
    }

    return evicted;
  }

  start() {
    this.timer ??= setInterval(() => this.check(), evictionCheckIntervalMs);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = undefined;
  }
}
