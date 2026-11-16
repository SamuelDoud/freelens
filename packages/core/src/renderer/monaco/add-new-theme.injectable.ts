/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";

import type { MonacoThemeData } from "../components/monaco-editor";
import type { MonacoModule } from "./monaco-loader";

const addNewMonacoThemeInjectable = getInjectable({
  id: "add-new-monaco-theme",
  instantiate: () => (monaco: MonacoModule, data: MonacoThemeData) => monaco.editor.defineTheme(data.name, data),
  causesSideEffects: true,
});

export default addNewMonacoThemeInjectable;
