/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { beforeExtensionEntryPointImportInjectionToken } from "../../../../extensions/extension-loader/before-entry-point-import";
import { loadTerminal } from "./terminal-loader";

// The extension API publishes `terminalStore`, whose `connect()` creates a
// terminal and whose `getTerminal()` returns it at once, so xterm has to be
// loaded by the time an extension can call them. Sessions without extensions
// never pay for it.
const loadTerminalBeforeExtensionEntryPointInjectable = getInjectable({
  id: "load-terminal-before-extension-entry-point",
  instantiate: () => async () => {
    await loadTerminal();
  },
  injectionToken: beforeExtensionEntryPointImportInjectionToken,
});

export default loadTerminalBeforeExtensionEntryPointInjectable;
