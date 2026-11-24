/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { onMonacoLoaded } from "./monaco-loader";
import { getYamlFoldingRanges } from "./yaml-folding-ranges";

const registerYamlFoldingRangeProviderInjectable = getInjectable({
  id: "register-yaml-folding-range-provider",
  // Monaco loads on first use, so the provider is registered when it does.
  instantiate: () => () => {
    onMonacoLoaded((monaco) => {
      monaco.languages.registerFoldingRangeProvider("yaml", {
        provideFoldingRanges: (model) => getYamlFoldingRanges(model.getLinesContent()),
      });
    });
  },
  causesSideEffects: true,
});

export default registerYamlFoldingRangeProviderInjectable;
