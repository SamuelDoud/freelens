/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { sendMessageToChannelInjectionToken } from "@freelensapp/messaging";
import { getInjectable } from "@ogre-tools/injectable";
import { beforeFrameStartsSecondInjectionToken } from "../../../renderer/before-frame-starts/tokens";
import { chatWindowChatId } from "../../ai-chat/renderer/chat-window";
import { historyGoChannel } from "../common/channels";

// The "back" and "forward" buttons of a mouse
const mouseButtonSteps: Partial<Record<number, number>> = { 3: -1, 4: 1 };

/** Steps back and forward with the mouse's own buttons, from any frame. */
const mouseHistoryButtonsInjectable = getInjectable({
  id: "history-mouse-buttons",
  instantiate: (di) => ({
    run: () => {
      const send = di.inject(sendMessageToChannelInjectionToken);

      // The step goes to every window: a chat's own window has no history of the application to go back in.
      if (chatWindowChatId()) {
        return;
      }

      window.addEventListener("mouseup", (event) => {
        const delta = mouseButtonSteps[event.button];

        if (delta) {
          event.preventDefault();
          send(historyGoChannel, delta);
        }
      });
    },
  }),
  injectionToken: beforeFrameStartsSecondInjectionToken,
});

export default mouseHistoryButtonsInjectable;
