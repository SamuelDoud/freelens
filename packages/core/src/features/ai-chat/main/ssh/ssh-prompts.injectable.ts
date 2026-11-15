/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { sendMessageToChannelInjectionToken } from "@freelensapp/messaging";
import { getInjectable } from "@ogre-tools/injectable";
import { aiSshPromptChannel, aiSshPromptSettledChannel } from "../../common/channels";

import type { AiSshPrompt } from "../../common/channels";

export interface AiSshPrompts {
  /** Asks the user in the windows; resolves with the answer, or undefined when cancelled */
  ask: (prompt: AiSshPrompt) => Promise<string | undefined>;
  /** The answer of one window: the first one counts */
  answer: (id: string, answer: string | undefined) => void;
}

const aiSshPromptsInjectable = getInjectable({
  id: "ai-chat-ssh-prompts",
  instantiate: (di): AiSshPrompts => {
    const send = di.inject(sendMessageToChannelInjectionToken);
    const pending = new Map<string, (answer: string | undefined) => void>();

    return {
      ask: (prompt) =>
        new Promise((resolve) => {
          pending.set(prompt.id, resolve);
          send(aiSshPromptChannel, prompt);
        }),
      answer: (id, answer) => {
        const resolve = pending.get(id);

        if (resolve) {
          pending.delete(id);
          resolve(answer);
          send(aiSshPromptSettledChannel, { id });
        }
      },
    };
  },
});

export default aiSshPromptsInjectable;
