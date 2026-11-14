/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { reactApplicationChildrenInjectionToken } from "@freelensapp/react-application";
import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import { AiChatWindowFrame } from "../../features/ai-chat/renderer/ai-chat-window-frame";
import { chatWindowChatId } from "../../features/ai-chat/renderer/chat-window";
import { ClusterFrame } from "./cluster-frame/cluster-frame";
import { RootFrame } from "./root-frame/root-frame";

const frameApplicationRootInjectable = getInjectable({
  id: "frame-application-root",

  instantiate: () => {
    // Both frames were bundled by webpack too; the conditional require() only
    // deferred evaluation, which ESM output cannot express synchronously.
    // A chat's own window shows the chat alone, without the application around it.
    const Frame = chatWindowChatId() ? AiChatWindowFrame : process.isMainFrame ? RootFrame : ClusterFrame;

    return {
      id: "frame-application-root",
      Component: Frame,
      enabled: computed(() => true),
    };
  },

  causesSideEffects: true,

  injectionToken: reactApplicationChildrenInjectionToken,
});

export default frameApplicationRootInjectable;
