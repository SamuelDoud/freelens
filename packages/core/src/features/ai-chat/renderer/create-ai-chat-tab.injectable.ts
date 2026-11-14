/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import openAiChatInjectable from "./open-ai-chat.injectable";

/** The dock's + menu opens a chat in the dock, whatever the last placement was. */
const createAiChatTabInjectable = getInjectable({
  id: "create-ai-chat-tab",
  instantiate: (di) => {
    const openAiChat = di.inject(openAiChatInjectable);

    return () => void openAiChat("bottom");
  },
});

export default createAiChatTabInjectable;
