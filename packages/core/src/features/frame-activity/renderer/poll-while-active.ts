/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { reaction } from "mobx";

import type { FrameActivity } from "./frame-activity.injectable";

/**
 * Runs `poll` every `seconds` while the frame is active, and at once when it
 * becomes active again, so that what it shows is current when it is seen.
 * Returns the function that stops it.
 */
export function pollWhileActive(activity: FrameActivity, seconds: number, poll: () => void): () => void {
  let timer: ReturnType<typeof setInterval> | undefined;

  const stopTimer = () => {
    clearInterval(timer);
    timer = undefined;
  };

  const stopReaction = reaction(
    () => activity.get(),
    (active) => {
      stopTimer();

      if (active) {
        poll();
        timer = setInterval(poll, seconds * 1000);
      }
    },
    { fireImmediately: true },
  );

  return () => {
    stopReaction();
    stopTimer();
  };
}
