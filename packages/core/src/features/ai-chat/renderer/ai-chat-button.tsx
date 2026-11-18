/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Icon } from "@freelensapp/icon";
import { cssNames } from "@freelensapp/utilities";
import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import frameActivityInjectable from "../../frame-activity/renderer/frame-activity.injectable";
import userPreferencesStateInjectable from "../../user-preferences/common/state.injectable";
import styles from "./ai-chat-button.module.scss";

import type { FrameActivity } from "../../frame-activity/renderer/frame-activity.injectable";
import type { UserPreferencesState } from "../../user-preferences/common/state.injectable";

export interface AiChatButtonProps {
  onClick: () => void;
  className?: string;
  "data-testid"?: string;
}

interface Dependencies {
  state: UserPreferencesState;
  frameActivity: FrameActivity;
}

/**
 * The robot that opens the AI chat. It glows until the user opens a chat for the first time, so that
 * the chat is found without hunting for it.
 */
const NonInjectedAiChatButton = observer(
  ({ onClick, className, state, frameActivity, ...rest }: AiChatButtonProps & Dependencies) => {
    const glowing = !state.aiChat?.discovered;
    // Pulse only where it can be seen: not in the frame of a hidden cluster or a hidden window. Becoming
    // visible again starts the pulses anew.
    const pulsing = glowing && frameActivity.get();

    return (
      <button
        type="button"
        className={cssNames(styles.aiChatButton, className, { [styles.glowing]: glowing, [styles.pulsing]: pulsing })}
        title="AI chat"
        aria-label="AI chat"
        data-testid={rest["data-testid"]}
        data-glowing={glowing}
        onClick={onClick}
      >
        <Icon material="smart_toy" small />
        <span className={styles.label}>AI chat</span>
      </button>
    );
  },
);

export const AiChatButton = withInjectables<Dependencies, AiChatButtonProps>(NonInjectedAiChatButton, {
  getProps: (di, props) => ({
    ...props,
    state: di.inject(userPreferencesStateInjectable),
    frameActivity: di.inject(frameActivityInjectable),
  }),
});
