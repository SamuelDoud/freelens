/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Icon } from "@freelensapp/icon";
import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import { HistoryStepsMenu } from "../../../../../../features/history/renderer/history-steps-menu";
import goForwardInjectable from "./go-forward/go-forward.injectable";
import topBarNextEnabledInjectable from "./next-enabled.injectable";

import type { IComputedValue } from "mobx";

interface Dependencies {
  nextEnabled: IComputedValue<boolean>;
  goForward: () => void;
}

const NonInjectedNavigationToForward = observer(({ nextEnabled, goForward }: Dependencies) => (
  <HistoryStepsMenu direction={1}>
    <Icon
      data-testid="history-forward"
      material="arrow_forward"
      tooltip="Forward (right-click or hold for the list)"
      onClick={goForward}
      disabled={!nextEnabled.get()}
    />
  </HistoryStepsMenu>
));

export const NavigationToForward = withInjectables<Dependencies>(
  NonInjectedNavigationToForward,

  {
    getProps: (di) => ({
      nextEnabled: di.inject(topBarNextEnabledInjectable),
      goForward: di.inject(goForwardInjectable),
    }),
  },
);
