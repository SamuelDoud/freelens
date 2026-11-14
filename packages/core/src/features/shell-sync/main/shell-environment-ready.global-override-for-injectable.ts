/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getGlobalOverride } from "@freelensapp/test-utils";
import shellEnvironmentReadyInjectable from "./shell-environment-ready.injectable";

// Unit tests do not sync a login shell: what waits for its environment goes on at once.
export default getGlobalOverride(shellEnvironmentReadyInjectable, () => ({
  wait: () => Promise.resolve(),
  settle: () => {},
}));
