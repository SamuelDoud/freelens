/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getMessageChannelListenerInjectable } from "@freelensapp/messaging";
import { aiSshPromptAnswerChannel } from "../../common/channels";
import aiSshPromptsInjectable from "./ssh-prompts.injectable";

const aiSshPromptAnswerListenerInjectable = getMessageChannelListenerInjectable({
  id: "ai-chat-ssh-prompt-answer",
  channel: aiSshPromptAnswerChannel,
  getHandler: (di) => {
    const prompts = di.inject(aiSshPromptsInjectable);

    return ({ id, answer }) => prompts.answer(id, answer);
  },
});

export default aiSshPromptAnswerListenerInjectable;
