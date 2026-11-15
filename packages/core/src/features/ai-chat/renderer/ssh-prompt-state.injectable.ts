/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";

/** The prompt of ssh this window shows, if any */
const aiSshPromptStateInjectable = getInjectable({
  id: "ai-chat-ssh-prompt-state",
  instantiate: () => ({ openId: undefined as string | undefined }),
});

export default aiSshPromptStateInjectable;
