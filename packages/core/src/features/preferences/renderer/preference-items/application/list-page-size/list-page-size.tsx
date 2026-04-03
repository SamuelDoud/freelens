/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { defaultKubeApiPageSize } from "@freelensapp/kube-api";
import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import React from "react";
import { Input, InputValidators } from "../../../../../../renderer/components/input";
import { SubTitle } from "../../../../../../renderer/components/layout/sub-title";
import userPreferencesStateInjectable from "../../../../../user-preferences/common/state.injectable";

import type { UserPreferencesState } from "../../../../../user-preferences/common/state.injectable";

interface Dependencies {
  state: UserPreferencesState;
}

const NonInjectedListPageSize = observer(({ state }: Dependencies) => (
  <section>
    <SubTitle title="List page size" />
    <Input
      theme="round-black"
      type="number"
      min={1}
      validators={InputValidators.isNumber}
      value={state.listPageSize.toString()}
      step={1}
      onChange={(value) => (state.listPageSize = Math.max(1, Math.floor(Number(value) || defaultKubeApiPageSize)))}
    />
    <small className="hint">
      Number of items fetched per page from the Kubernetes API (default: {defaultKubeApiPageSize}). Lower values reduce
      memory usage and improve responsiveness on slower connections.
    </small>
  </section>
));

export const ListPageSize = withInjectables<Dependencies>(NonInjectedListPageSize, {
  getProps: (di) => ({
    state: di.inject(userPreferencesStateInjectable),
  }),
});
