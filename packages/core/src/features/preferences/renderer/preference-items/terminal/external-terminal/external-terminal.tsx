/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import React from "react";
import { SubTitle } from "../../../../../../renderer/components/layout/sub-title";
import { Switch } from "../../../../../../renderer/components/switch";
import userPreferencesStateInjectable from "../../../../../user-preferences/common/state.injectable";

import type { UserPreferencesState } from "../../../../../user-preferences/common/state.injectable";

interface Dependencies {
  state: UserPreferencesState;
}

const NonInjectedExternalTerminal = observer(({ state }: Dependencies) => (
  <section id="externalTerminal">
    <SubTitle title="External terminal" />
    <Switch
      checked={state.useExternalTerminal}
      onChange={() => (state.useExternalTerminal = !state.useExternalTerminal)}
    >
      Open pod shells in external terminal (iTerm2 / Terminal.app)
    </Switch>
  </section>
));

export const ExternalTerminal = withInjectables<Dependencies>(NonInjectedExternalTerminal, {
  getProps: (di) => ({
    state: di.inject(userPreferencesStateInjectable),
  }),
});
