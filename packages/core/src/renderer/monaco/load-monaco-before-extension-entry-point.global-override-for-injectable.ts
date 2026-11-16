/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getGlobalOverride } from "@freelensapp/test-utils";
import loadMonacoBeforeExtensionEntryPointInjectable from "./load-monaco-before-extension-entry-point.injectable";

export default getGlobalOverride(loadMonacoBeforeExtensionEntryPointInjectable, () => async () => {});
