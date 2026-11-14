/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { action, makeObservable, observable } from "mobx";

export interface ExpandedRowsDependencies {
  now: () => number;
  requestFrame: (callback: () => void) => unknown;
  /** Open and close at once, without the slide. */
  reducedMotion: () => boolean;
}

/** How long a row's details take to slide open or closed. */
export const expandDurationMs = 180;

const easeOut = (progress: number) => 1 - (1 - progress) ** 3;

/**
 * The rows of one list whose details are open under them. Each open row slides its details open
 * from 0 to the height they measure, and back on closing; the list reads the height to make room.
 */
export class ExpandedRows {
  private readonly open = observable.set<string>();
  /** The height of each row's details, as measured once they render. */
  private readonly measured = observable.map<string, number>();
  /** How far each row is opened, from 0 (closed) to 1 (open); a closed row has no entry. */
  private readonly progress = observable.map<string, number>();
  private readonly animations = new Map<string, { from: number; to: number; start: number }>();

  constructor(private readonly dependencies: ExpandedRowsDependencies) {
    makeObservable<ExpandedRows, "step">(this, {
      toggle: action,
      openRow: action,
      close: action,
      closeAll: action,
      setMeasured: action,
      step: action,
    });
  }

  isOpen(id: string) {
    return this.open.has(id);
  }

  get openIds(): string[] {
    return [...this.open];
  }

  /** Whether the row's details are in the page: open, or still sliding closed. */
  isShown(id: string) {
    return this.open.has(id) || this.progress.has(id);
  }

  /** The room the row's details take under it now. */
  extraHeight(id: string) {
    const progress = this.progress.get(id);

    return progress === undefined ? 0 : Math.round((this.measured.get(id) ?? 0) * easeOut(progress));
  }

  toggle(id: string) {
    if (this.open.has(id)) {
      this.close(id);
    } else {
      this.openRow(id);
    }
  }

  openRow(id: string) {
    this.open.add(id);
    this.animate(id, 1);
  }

  close(id: string) {
    this.open.delete(id);
    this.animate(id, 0);
  }

  closeAll() {
    for (const id of [...this.open]) {
      this.close(id);
    }
  }

  setMeasured(id: string, height: number) {
    if (this.measured.get(id) !== height) {
      this.measured.set(id, height);
    }
  }

  private animate(id: string, to: number) {
    const from = this.progress.get(id) ?? 0;

    if (this.dependencies.reducedMotion()) {
      this.finish(id, to);

      return;
    }

    const running = this.animations.has(id);

    this.animations.set(id, { from, to, start: this.dependencies.now() });
    this.progress.set(id, from);

    if (!running) {
      this.dependencies.requestFrame(() => this.step(id));
    }
  }

  private step(id: string) {
    const animation = this.animations.get(id);

    if (!animation) {
      return;
    }

    const elapsed = (this.dependencies.now() - animation.start) / expandDurationMs;

    if (elapsed >= 1) {
      this.animations.delete(id);
      this.finish(id, animation.to);

      return;
    }

    this.progress.set(id, animation.from + (animation.to - animation.from) * Math.max(0, elapsed));
    this.dependencies.requestFrame(() => this.step(id));
  }

  private finish(id: string, to: number) {
    if (to === 0) {
      this.progress.delete(id);
      this.measured.delete(id);
    } else {
      this.progress.set(id, 1);
    }
  }
}
