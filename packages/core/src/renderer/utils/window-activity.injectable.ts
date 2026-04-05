/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { action, observable } from "mobx";

/**
 * Tracks whether the window is actively visible to the user.
 * Used to back off polling intervals when the app is in the background,
 * reducing CPU usage and battery drain on laptops.
 *
 * Becomes inactive when:
 * - The window/tab is hidden (visibilitychange)
 * - The user hasn't interacted for 5 minutes (idle timeout)
 *
 * Consumers should multiply their polling interval by INACTIVE_MULTIPLIER
 * when isActive is false.
 */
export const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
export const INACTIVE_MULTIPLIER = 5; // 5x slower when inactive

const windowActivityInjectable = getInjectable({
  id: "window-activity",

  instantiate: () => {
    const isActive = observable.box(true);
    let idleTimer: ReturnType<typeof setTimeout> | undefined;

    const resetIdleTimer = action(() => {
      isActive.set(true);

      if (idleTimer) clearTimeout(idleTimer);

      idleTimer = setTimeout(
        action(() => isActive.set(false)),
        IDLE_TIMEOUT_MS,
      );
    });

    // Throttle high-frequency events (mousemove fires on every pixel)
    let lastActivity = 0;

    const throttledResetIdleTimer = () => {
      const now = Date.now();

      if (now - lastActivity > 1000) {
        lastActivity = now;
        resetIdleTimer();
      }
    };

    const onVisibilityChange = action(() => {
      if (document.hidden) {
        isActive.set(false);
      } else {
        resetIdleTimer();
      }
    });

    // Set up listeners
    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("mousemove", throttledResetIdleTimer, { passive: true });
    document.addEventListener("keydown", throttledResetIdleTimer, { passive: true });
    document.addEventListener("click", resetIdleTimer, { passive: true });

    // Start idle timer
    resetIdleTimer();

    return { isActive };
  },

  causesSideEffects: true,
});

export default windowActivityInjectable;
