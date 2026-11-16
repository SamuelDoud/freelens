/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { compareStructural, createAtom, reaction, untracked } from "mobx";

import type { IAtom } from "mobx";

/**
 * A computed value that is worked out at most once per `interval`
 * milliseconds while something observes it, however often what it reads
 * changes.
 *
 * The first observer gets the value at once. After a change the value stays
 * as it was until the interval since the last computation has passed, then it
 * is computed again from the then current data. Nothing is computed, and
 * nothing is read, while nothing observes it: `get()` outside a reaction
 * computes on the spot, like `computed(...).get()`.
 */
export function throttledComputed<T>(compute: () => T, interval: number): { get(): T } {
  let value: T;
  let disposeReaction: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const stop = () => {
    disposeReaction?.();
    disposeReaction = undefined;

    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  const start = () => {
    // The reaction cannot run inside the batch of the observer that starts it,
    // so the first value is computed here, and the reaction tracks from its
    // first run, which comes when that batch ends.
    let lastRun = Date.now();

    value = untracked(compute);

    disposeReaction = reaction(
      () => compute(),
      (next) => {
        const changed = !compareStructural(value, next);

        value = next;

        if (changed) {
          atom.reportChanged();
        }
      },
      {
        fireImmediately: true,
        equals: compareStructural,
        scheduler: (run) => {
          const wait = lastRun + interval - Date.now();

          if (wait <= 0) {
            lastRun = Date.now();
            run();
          } else if (timer === undefined) {
            timer = setTimeout(() => {
              timer = undefined;
              lastRun = Date.now();
              run();
            }, wait);
          }
        },
      },
    );
  };

  const atom: IAtom = createAtom("throttledComputed", start, stop);

  return {
    get() {
      return atom.reportObserved() ? value : compute();
    },
  };
}
