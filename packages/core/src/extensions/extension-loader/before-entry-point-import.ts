/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectionToken } from "@ogre-tools/injectable";

/**
 * Work the extension loader awaits before it imports an extension's entry
 * point, so that what the entry point reads from the extension API globals at
 * evaluation time is in place. The renderer uses it to load Monaco, which is
 * loaded lazily and which extensions read as a synchronous singleton.
 */
export const beforeExtensionEntryPointImportInjectionToken = getInjectionToken<() => Promise<void>>({
  id: "before-extension-entry-point-import-token",
});
