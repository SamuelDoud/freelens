/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import { SubTitle } from "../../../../../../renderer/components/layout/sub-title";
import { Select } from "../../../../../../renderer/components/select";
import userPreferencesStateInjectable from "../../../../../user-preferences/common/state.injectable";

import type { RowClickAction } from "../../../../../user-preferences/common/preference-descriptors.injectable";
import type { UserPreferencesState } from "../../../../../user-preferences/common/state.injectable";

interface Dependencies {
  state: UserPreferencesState;
}

const options: { value: RowClickAction; label: string }[] = [
  { value: "expand", label: "Open its details under the row" },
  { value: "drawer", label: "Open its details in the side panel" },
];

const NonInjectedRowClick = observer(({ state }: Dependencies) => (
  <section id="row-click">
    <SubTitle title="Clicking a row in a list" />
    <Select
      id="row-click-action-input"
      options={options}
      value={state.rowClickAction}
      onChange={(option) => (state.rowClickAction = option?.value ?? "expand")}
      themeName="lens"
    />
    <small className="hint">
      The arrow at the left of a row always opens its details under it, and the button at its right in the side panel.
    </small>
  </section>
));

export const RowClick = withInjectables<Dependencies>(NonInjectedRowClick, {
  getProps: (di) => ({
    state: di.inject(userPreferencesStateInjectable),
  }),
});
