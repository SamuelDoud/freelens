/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getMessageChannelListenerInjectable } from "@freelensapp/messaging";
import confirmDialogStateInjectable from "../../../renderer/components/confirm-dialog/state.injectable";
import { aiSshPromptSettledChannel } from "../common/channels";
import aiSshPromptStateInjectable from "./ssh-prompt-state.injectable";

// A prompt answered in another window closes here.
const aiSshPromptSettledListenerInjectable = getMessageChannelListenerInjectable({
  id: "ai-chat-ssh-prompt-settled",
  channel: aiSshPromptSettledChannel,
  getHandler:
    (di) =>
    ({ id }) => {
      const state = di.inject(aiSshPromptStateInjectable);

      if (state.openId === id) {
        state.openId = undefined;
        di.inject(confirmDialogStateInjectable).set(undefined);
      }
    },
});

export default aiSshPromptSettledListenerInjectable;
