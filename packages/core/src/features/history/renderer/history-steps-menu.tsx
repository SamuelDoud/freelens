/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import { useState } from "react";
import { Menu, MenuItem } from "../../../renderer/components/menu";
import getClusterByIdInjectable from "../../cluster/storage/common/get-by-id.injectable";
import { describeEntry } from "../common/timeline";
import historyControllerInjectable from "./history-controller.injectable";
import timelineInjectable from "./timeline.injectable";

import type { StrictReactNode } from "@freelensapp/utilities";

import type { Timeline } from "../common/timeline";
import type { HistoryController } from "./history-controller.injectable";

export interface HistoryStepsMenuProps {
  /** The steps behind (-1) or ahead (1) */
  direction: -1 | 1;
  children: StrictReactNode;
}

interface Dependencies {
  timeline: Timeline;
  controller: HistoryController;
  clusterName: (id: string) => string | undefined;
}

const longPressMs = 500;

/**
 * Wraps a back or forward button: a right click or a long press on it lists
 * the steps that way, to jump to any of them.
 */
const NonInjectedHistoryStepsMenu = observer(
  ({ direction, children, timeline, controller, clusterName }: HistoryStepsMenuProps & Dependencies) => {
    const [isOpen, setOpen] = useState(false);
    const [pressTimer, setPressTimer] = useState<ReturnType<typeof setTimeout>>();
    const id = `history-steps-${direction < 0 ? "back" : "forward"}`;
    const steps = timeline.around(direction);

    const cancelPress = () => {
      clearTimeout(pressTimer);
      setPressTimer(undefined);
    };

    return (
      <>
        <span
          id={id}
          onMouseDown={(event) => {
            if (event.button === 0 && steps.length) {
              setPressTimer(setTimeout(() => setOpen(true), longPressMs));
            }
          }}
          onMouseUp={cancelPress}
          onMouseLeave={cancelPress}
        >
          {children}
        </span>
        <Menu
          usePortal
          htmlFor={id}
          isOpen={isOpen && steps.length > 0}
          toggleEvent="contextmenu"
          open={() => setOpen(true)}
          close={() => setOpen(false)}
          data-testid={`${id}-menu`}
        >
          {steps.map(({ delta, entry }) => (
            <MenuItem key={delta} onClick={() => controller.go(delta)} data-testid={`history-step-${delta}`}>
              {describeEntry(entry, clusterName)}
            </MenuItem>
          ))}
        </Menu>
      </>
    );
  },
);

export const HistoryStepsMenu = withInjectables<Dependencies, HistoryStepsMenuProps>(NonInjectedHistoryStepsMenu, {
  getProps: (di, props) => ({
    ...props,
    timeline: di.inject(timelineInjectable),
    controller: di.inject(historyControllerInjectable),
    clusterName: (id) => di.inject(getClusterByIdInjectable)(id)?.name.get(),
  }),
});
