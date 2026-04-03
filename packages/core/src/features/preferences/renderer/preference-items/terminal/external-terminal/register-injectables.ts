/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import externalTerminalPreferenceItemInjectable from "./external-terminal-preference-item.injectable";

import type { DiContainerForInjection } from "@ogre-tools/injectable";

export function registerInjectables(di: DiContainerForInjection): void {
  try {
    di.register(externalTerminalPreferenceItemInjectable);
  } catch (e) {
    /* Ignore duplicate registration */
  }
}
