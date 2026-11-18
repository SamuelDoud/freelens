/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import { SubTitle } from "../../../../../../renderer/components/layout/sub-title";
import { Switch } from "../../../../../../renderer/components/switch";
import userPreferencesStateInjectable from "../../../../../user-preferences/common/state.injectable";

import type { UserPreferencesState } from "../../../../../user-preferences/common/state.injectable";

interface Dependencies {
  state: UserPreferencesState;
}

const NonInjectedExperimentalRowsPodsList = observer(({ state }: Dependencies) => (
  <section id="experimental-rows-pods-list">
    <SubTitle title="Experimental" />
    <Switch
      checked={state.experimentalRowsPodsList}
      onChange={() => {
        state.experimentalRowsPodsList = !state.experimentalRowsPodsList;
      }}
    >
      Load the Pods list as compact rows from a local service
    </Switch>
    <small className="hint">
      A helper process per cluster keeps the pod rows and streams changes in batches, so the list does not load every
      full pod. Search covers the visible columns only, and the row menu is missing. Reload the cluster view after
      changing it.
    </small>
  </section>
));

export const ExperimentalRowsPodsList = withInjectables<Dependencies>(NonInjectedExperimentalRowsPodsList, {
  getProps: (di) => ({
    state: di.inject(userPreferencesStateInjectable),
  }),
});
