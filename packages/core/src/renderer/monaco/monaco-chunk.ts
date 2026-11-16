/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

// The one module that statically pulls Monaco into the renderer. Everything
// else reaches it through `loadMonaco()` in `./monaco-loader.ts`, which imports
// this file dynamically so that Monaco and its worker constructors form their
// own chunk instead of weighing on the application's start.

import "./setup-monaco-environment";

export * as monaco from "monaco-editor";
