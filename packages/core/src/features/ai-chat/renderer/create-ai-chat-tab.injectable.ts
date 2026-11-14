/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { TabKind } from "../../../renderer/components/dock/dock/store";
import dockStoreInjectable from "../../../renderer/components/dock/dock/store.injectable";

const createAiChatTabInjectable = getInjectable({
  id: "create-ai-chat-tab",
  instantiate: (di) => {
    const dockStore = di.inject(dockStoreInjectable);

    return () => dockStore.createTab({ title: "AI chat", kind: TabKind.AI_CHAT });
  },
});

export default createAiChatTabInjectable;
