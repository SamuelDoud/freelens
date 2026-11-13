/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { AdvancedSearchState } from "./advanced-search-state";

const advancedSearchStateInjectable = getInjectable({
  id: "advanced-search-state",
  instantiate: () => new AdvancedSearchState(),
});

export default advancedSearchStateInjectable;
