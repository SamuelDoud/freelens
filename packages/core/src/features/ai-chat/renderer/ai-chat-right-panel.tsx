/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { ResizeDirection, ResizeGrowthDirection, ResizeSide, ResizingAnchor } from "@freelensapp/resizing-anchor";
import { cssNames } from "@freelensapp/utilities";
import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import { useState } from "react";
import hostedClusterInjectable from "../../../renderer/cluster-frame-context/hosted-cluster.injectable";
import userPreferencesStateInjectable from "../../user-preferences/common/state.injectable";
import { defaultAiChatPreferences } from "../common/preferences";
import styles from "./ai-chat-right-panel.module.scss";
import { AiChatView } from "./ai-chat-view";
import aiChatMirrorInjectable from "./chat-mirror.injectable";

import type { Cluster } from "../../../common/cluster/cluster";
import type { UserPreferencesState } from "../../user-preferences/common/state.injectable";
import type { AiChatMirror } from "./chat-mirror.injectable";

interface Dependencies {
  mirror: AiChatMirror;
  cluster: Cluster | undefined;
  state: UserPreferencesState;
}

/** The chats of this cluster placed at the right, beside the cluster view, full height and resizable. */
const NonInjectedAiChatRightPanel = observer(({ mirror, cluster, state }: Dependencies) => {
  const chats = cluster ? mirror.forCluster(cluster.id, "right") : [];
  const [selected, setSelected] = useState<string>();
  const preferences = state.aiChat ?? defaultAiChatPreferences;

  if (chats.length === 0) {
    return null;
  }

  const shown = chats.find((chat) => chat.id === selected) ?? chats[chats.length - 1];
  const setWidth = (rightPanelWidth: number) => {
    state.aiChat = { ...preferences, rightPanelWidth };
  };

  return (
    <div className={styles.rightPanel} style={{ width: preferences.rightPanelWidth }} data-testid="ai-chat-right-panel">
      <ResizingAnchor
        direction={ResizeDirection.HORIZONTAL}
        placement={ResizeSide.LEADING}
        growthDirection={ResizeGrowthDirection.RIGHT_TO_LEFT}
        getCurrentExtent={() => preferences.rightPanelWidth}
        onDrag={setWidth}
        onDoubleClick={() => setWidth(defaultAiChatPreferences.rightPanelWidth)}
        minExtent={280}
        maxExtent={1200}
      />
      {chats.length > 1 && (
        <div className={styles.tabs}>
          {chats.map((chat, index) => (
            <button
              type="button"
              key={chat.id}
              className={cssNames(styles.tab, { [styles.active]: chat.id === shown.id })}
              onClick={() => setSelected(chat.id)}
            >
              Chat {index + 1}
            </button>
          ))}
        </div>
      )}
      <AiChatView key={shown.id} chatId={shown.id} />
    </div>
  );
});

export const AiChatRightPanel = withInjectables<Dependencies>(NonInjectedAiChatRightPanel, {
  getProps: (di, props) => ({
    ...props,
    mirror: di.inject(aiChatMirrorInjectable),
    cluster: di.inject(hostedClusterInjectable),
    state: di.inject(userPreferencesStateInjectable),
  }),
});
