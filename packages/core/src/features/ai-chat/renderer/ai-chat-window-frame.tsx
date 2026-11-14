/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import { useEffect } from "react";
import { AiChatView } from "./ai-chat-view";
import styles from "./ai-chat-window-frame.module.scss";
import aiChatMirrorInjectable from "./chat-mirror.injectable";
import { chatWindowChatId } from "./chat-window";

import type { AiChatMirror } from "./chat-mirror.injectable";

interface Dependencies {
  mirror: AiChatMirror;
}

/** All a chat's window shows: the chat, filling the window. */
const NonInjectedAiChatWindowFrame = observer(({ mirror }: Dependencies) => {
  const chatId = chatWindowChatId() ?? "";

  useEffect(() => {
    void mirror.load();
  }, [mirror]);

  const clusterName = mirror.get(chatId)?.clusterName;

  useEffect(() => {
    document.title = clusterName ? `AI chat — ${clusterName}` : "AI chat";
  }, [clusterName]);

  return (
    <div className={styles.window} data-testid="ai-chat-window">
      <AiChatView chatId={chatId} />
    </div>
  );
});

export const AiChatWindowFrame = withInjectables<Dependencies>(NonInjectedAiChatWindowFrame, {
  getProps: (di, props) => ({ ...props, mirror: di.inject(aiChatMirrorInjectable) }),
});
