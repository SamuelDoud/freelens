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

const NonInjectedUnloadHiddenClusters = observer(({ state }: Dependencies) => (
  <section id="unload-hidden-clusters">
    <SubTitle title="Memory" />
    <Switch
      checked={state.unloadHiddenClusters}
      onChange={() => {
        state.unloadHiddenClusters = !state.unloadHiddenClusters;
      }}
    >
      Unload clusters hidden for 10 minutes
    </Switch>
    <small className="hint">
      A cluster that is not shown is unloaded after a while, or sooner when many are open or memory runs short, and
      loads again, on the same page, when you open it. Clusters with a terminal, followed logs, unsaved changes, a
      running chat or a port forward are never unloaded. Turn it off to keep every cluster instant.
    </small>
  </section>
));

export const UnloadHiddenClusters = withInjectables<Dependencies>(NonInjectedUnloadHiddenClusters, {
  getProps: (di) => ({
    state: di.inject(userPreferencesStateInjectable),
  }),
});
