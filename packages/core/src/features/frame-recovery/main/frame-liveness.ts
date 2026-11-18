/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

export interface FrameLivenessDependencies {
  /** The frames the window has told the main process about, by cluster */
  readonly getFrames: () => Iterable<[string, { frameId: number; processId: number }]>;
  /** Whether the frame is still there: its renderer process has not gone */
  readonly isAlive: (frame: { frameId: number; processId: number }) => boolean;
  /** Called once for a cluster whose frame is gone, after it is forgotten */
  readonly onGone: (clusterId: string) => void;
  readonly forget: (clusterId: string) => void;
}

/**
 * Finds the cluster frames whose renderer process has gone. Electron tells the
 * main process nothing about a process that held only a sub-frame, so each
 * frame is asked for. A frame has to be found gone twice running, with the same
 * ids, before it counts: a frame the window has just replaced, or a window that
 * reloads, is gone for a moment before the new frame says where it is.
 */
export class FrameLiveness {
  private readonly suspected = new Map<string, string>();

  constructor(private readonly dependencies: FrameLivenessDependencies) {}

  check(): void {
    const seen = new Set<string>();

    for (const [clusterId, frame] of [...this.dependencies.getFrames()]) {
      seen.add(clusterId);

      if (this.dependencies.isAlive(frame)) {
        this.suspected.delete(clusterId);
        continue;
      }

      const key = `${frame.processId}:${frame.frameId}`;

      if (this.suspected.get(clusterId) !== key) {
        this.suspected.set(clusterId, key);
        continue;
      }

      this.suspected.delete(clusterId);
      this.dependencies.forget(clusterId);
      this.dependencies.onGone(clusterId);
    }

    for (const clusterId of this.suspected.keys()) {
      if (!seen.has(clusterId)) {
        this.suspected.delete(clusterId);
      }
    }
  }
}
