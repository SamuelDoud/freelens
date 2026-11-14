/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Icon } from "@freelensapp/icon";
import { withInjectables } from "@ogre-tools/injectable-react";
import { runInAction } from "mobx";
import { observer } from "mobx-react";
import userPreferencesStateInjectable from "../../../../../../features/user-preferences/common/state.injectable";

import type { UserPreferencesState } from "../../../../../../features/user-preferences/common/state.injectable";

interface Dependencies {
  state: UserPreferencesState;
}

/**
 * Collapses and expands the cluster bar. The arrow points out of the window's
 * edge to expand a collapsed bar, and in to collapse an open one.
 */
const NonInjectedHotbarToggle = observer(({ state }: Dependencies) => {
  const collapsed = state.hotbarCollapsed;

  return (
    <Icon
      data-testid="hotbar-toggle"
      material={collapsed ? "keyboard_double_arrow_right" : "keyboard_double_arrow_left"}
      tooltip={collapsed ? "Show the cluster bar" : "Hide the cluster bar"}
      onClick={() =>
        runInAction(() => {
          state.hotbarCollapsed = !collapsed;
        })
      }
    />
  );
});

export const HotbarToggle = withInjectables<Dependencies>(NonInjectedHotbarToggle, {
  getProps: (di) => ({
    state: di.inject(userPreferencesStateInjectable),
  }),
});
