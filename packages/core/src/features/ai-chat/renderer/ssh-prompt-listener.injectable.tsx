/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Icon } from "@freelensapp/icon";
import { getMessageChannelListenerInjectable, sendMessageToChannelInjectionToken } from "@freelensapp/messaging";
import openConfirmDialogInjectable from "../../../renderer/components/confirm-dialog/open.injectable";
import currentlyInClusterFrameInjectable from "../../../renderer/routes/currently-in-cluster-frame.injectable";
import { aiSshPromptAnswerChannel, aiSshPromptChannel } from "../common/channels";
import { SshPromptMessage } from "./ssh-prompt-dialog";
import aiSshPromptStateInjectable from "./ssh-prompt-state.injectable";

// Asks the user what ssh asks while connecting to the host the CLIs run on: a host key, a
// passphrase, a password, the options or codes of a second factor such as Duo. The windows ask,
// not the clusters' frames; the first answer counts.
const aiSshPromptListenerInjectable = getMessageChannelListenerInjectable({
  id: "ai-chat-ssh-prompt",
  channel: aiSshPromptChannel,
  getHandler: (di) => {
    const inClusterFrame = di.inject(currentlyInClusterFrameInjectable);

    return (prompt) => {
      if (inClusterFrame) {
        return;
      }

      const send = di.inject(sendMessageToChannelInjectionToken);
      const state = di.inject(aiSshPromptStateInjectable);
      const reply = (answer: string | undefined) => {
        state.openId = undefined;
        send(aiSshPromptAnswerChannel, { id: prompt.id, answer });
      };
      let value = "";

      state.openId = prompt.id;
      di.inject(openConfirmDialogInjectable)({
        // A host key to accept warrants the warning; a passphrase or a code does not.
        ...(prompt.kind === "confirm" ? {} : { icon: <Icon big material="vpn_key" /> }),
        message: <SshPromptMessage prompt={prompt} onChange={(next) => (value = next)} />,
        labelOk: prompt.kind === "confirm" ? "Yes" : "Continue",
        labelCancel: prompt.kind === "confirm" ? "No" : "Cancel",
        // ssh takes "yes" to a confirmation; "no" refuses it rather than cancelling the connection.
        ok: () => reply(prompt.kind === "confirm" ? "yes" : value),
        cancel: () => reply(prompt.kind === "confirm" ? "no" : undefined),
      });
    };
  },
});

export default aiSshPromptListenerInjectable;
