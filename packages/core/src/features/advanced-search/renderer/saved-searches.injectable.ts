/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import userPreferencesStateInjectable from "../../user-preferences/common/state.injectable";
import { SavedSearches } from "./saved-search-store";

const savedSearchesInjectable = getInjectable({
  id: "saved-searches",
  instantiate: (di) => new SavedSearches(di.inject(userPreferencesStateInjectable)),
});

export default savedSearchesInjectable;
