/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import userPreferencesStateInjectable from "../../user-preferences/common/state.injectable";

/**
 * The one switch of the rows service, the `rowsService` preference. Everything
 * the feature does asks this, and nothing else reads the preference: while it is
 * off, no rows process runs, `/api-rows` answers 501, and the lists are the ones
 * built from full objects.
 */
const rowsServiceEnabledInjectable = getInjectable({
  id: "rows-service-enabled",
  instantiate: (di) => {
    const preferences = di.inject(userPreferencesStateInjectable);

    return computed(() => preferences.rowsService === true);
  },
});

export default rowsServiceEnabledInjectable;
