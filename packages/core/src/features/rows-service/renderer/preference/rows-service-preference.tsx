/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import { SubTitle } from "../../../../renderer/components/layout/sub-title";
import { Switch } from "../../../../renderer/components/switch";
import userPreferencesStateInjectable from "../../../user-preferences/common/state.injectable";

import type { UserPreferencesState } from "../../../user-preferences/common/state.injectable";

interface Dependencies {
  state: UserPreferencesState;
}

const NonInjectedRowsServicePreference = observer(({ state }: Dependencies) => (
  <section id="rows-service">
    <SubTitle title="Experimental" />
    <Switch
      checked={state.rowsService}
      onChange={() => {
        state.rowsService = !state.rowsService;
      }}
    >
      Rows service for the Pods list
    </Switch>
    <small className="hint">
      Runs a helper process per cluster that sends the Pods list as compact rows instead of full pods. Faster and
      lighter on clusters with thousands of pods. The helper's memory grows with the pod count, about 55 MB at 10,000
      pods. Search covers the visible columns only. Takes effect at once; turn it off to go back to the usual list.
    </small>
  </section>
));

export const RowsServicePreference = withInjectables<Dependencies>(NonInjectedRowsServicePreference, {
  getProps: (di) => ({
    state: di.inject(userPreferencesStateInjectable),
  }),
});
