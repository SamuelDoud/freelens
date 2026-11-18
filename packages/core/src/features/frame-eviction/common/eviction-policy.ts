/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

const MiB = 1024 * 1024;

/**
 * How long a cluster frame may stay hidden before it is evicted. By then the
 * stores of the frame have already let go of their items (they do so five
 * minutes after the last view that used them left, which a hidden frame never
 * does, because its view stays mounted), so what is left to free is the React
 * tree, the DI container, the metrics and the editors. Ten minutes is long
 * enough that going back and forth between a few clusters never meets an
 * evicted one, and short enough that a forgotten cluster does not hold a
 * hundred thousand pods for an afternoon.
 */
export const hiddenFrameEvictionMs = 10 * 60 * 1000;

/** A frame hidden for less than this is left alone by the limits below: someone moving between several clusters keeps them all instant. */
export const hiddenFrameGraceMs = 5 * 60 * 1000;

/**
 * How many hidden frames may stay alive, whatever their age. Frames that
 * cannot be evicted count, so with more protected frames than this, every
 * other hidden frame goes as soon as its grace is over.
 */
export const maxHiddenFrames = 5;

/**
 * The heap of the renderer process above which hidden frames go one by one,
 * the longest hidden first, whatever their age. The renderer of a 64-bit
 * Electron stops at about 4 GiB, and a frame holding 100k pods takes more than
 * 1 GiB of it, so at 2 GiB the next list that loads can still fit.
 *
 * It is the heap of the process the frame handler runs in, the window's. The
 * cluster frames share it only when they have no process of their own
 * (the preference "Run each cluster in its own process" is off); otherwise each
 * has a limit of its own, and the age and count limits above are what keeps
 * hidden clusters from piling up.
 */
export const hiddenFrameHeapLimitBytes = 2048 * MiB;

/** How often the limits are checked */
export const evictionCheckIntervalMs = 30 * 1000;

export interface HiddenFrame {
  readonly clusterId: string;
  /** When the frame stopped being shown */
  readonly hiddenSince: number;
  /** What the frame holds that is lost with it; none means it can be evicted */
  readonly protectedBy: readonly string[];
}

export interface EvictionInput {
  readonly hidden: readonly HiddenFrame[];
  readonly now: number;
  /** The heap in use in the renderer, when the platform says */
  readonly heapUsedBytes?: number;
}

/** Which hidden frames to evict now, the first to go first. A protected frame is never among them. */
export function pickFramesToEvict({ hidden, now, heapUsedBytes }: EvictionInput): string[] {
  const oldestFirst = [...hidden].sort((a, b) => a.hiddenSince - b.hiddenSince);
  const evictable = oldestFirst.filter((frame) => frame.protectedBy.length === 0);
  const picked = new Set<string>();

  for (const frame of evictable) {
    if (now - frame.hiddenSince >= hiddenFrameEvictionMs) {
      picked.add(frame.clusterId);
    }
  }

  const graceOver = evictable.filter((frame) => now - frame.hiddenSince >= hiddenFrameGraceMs);
  let alive = hidden.length - picked.size;

  for (const frame of graceOver) {
    if (alive <= maxHiddenFrames) {
      break;
    }

    if (!picked.has(frame.clusterId)) {
      picked.add(frame.clusterId);
      alive -= 1;
    }
  }

  if (heapUsedBytes !== undefined && heapUsedBytes > hiddenFrameHeapLimitBytes) {
    // One at a time: the heap only shrinks once the frame is gone and collected.
    const next = graceOver.find((frame) => !picked.has(frame.clusterId));

    if (next) {
      picked.add(next.clusterId);
    }
  }

  return oldestFirst.filter((frame) => picked.has(frame.clusterId)).map((frame) => frame.clusterId);
}
