/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { beforeExtensionEntryPointImportInjectionToken } from "../../extensions/extension-loader/before-entry-point-import";
import { loadMonaco } from "./monaco-loader";

// The extension API publishes Monaco as a synchronous singleton, which an
// extension reads while its entry point evaluates, so Monaco has to be loaded
// by then. Sessions without extensions never pay for it.
const loadMonacoBeforeExtensionEntryPointInjectable = getInjectable({
  id: "load-monaco-before-extension-entry-point",
  instantiate: () => async () => {
    await loadMonaco();
  },
  injectionToken: beforeExtensionEntryPointImportInjectionToken,
});

export default loadMonacoBeforeExtensionEntryPointInjectable;
