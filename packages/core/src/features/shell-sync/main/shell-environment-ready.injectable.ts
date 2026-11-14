/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";

export interface ShellEnvironmentReady {
  /** Settles once the environment of the login shell has been synced, or failed to */
  readonly wait: () => Promise<void>;
  readonly settle: () => void;
}

/**
 * The environment of the user's login shell (its PATH above all) is synced in
 * the background while the window opens. What starts other programs that need
 * it, such as connecting a cluster, waits for it here.
 */
const shellEnvironmentReadyInjectable = getInjectable({
  id: "shell-environment-ready",
  instantiate: (): ShellEnvironmentReady => {
    let settle!: () => void;
    const ready = new Promise<void>((resolve) => {
      settle = resolve;
    });

    return { wait: () => ready, settle };
  },
});

export default shellEnvironmentReadyInjectable;
