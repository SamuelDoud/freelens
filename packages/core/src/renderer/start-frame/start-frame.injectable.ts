/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { onLoadOfApplicationInjectionToken } from "@freelensapp/application";
import { runManyFor } from "@freelensapp/run-many";
import { getInjectable } from "@ogre-tools/injectable";
import { chatWindowChatId } from "../../features/ai-chat/renderer/chat-window";
import * as tokens from "../before-frame-starts/tokens";
import currentlyInClusterFrameInjectable from "../routes/currently-in-cluster-frame.injectable";

const startFrameInjectable = getInjectable({
  id: "start-frame",

  instantiate: (di) => {
    const runMany = runManyFor(di);
    const beforeFrameStartsFirst = runMany(tokens.beforeFrameStartsFirstInjectionToken);
    const beforeMainFrameStartsFirst = runMany(tokens.beforeMainFrameStartsFirstInjectionToken);
    const beforeClusterFrameStartsFirst = runMany(tokens.beforeClusterFrameStartsFirstInjectionToken);
    const beforeFrameStartsSecond = runMany(tokens.beforeFrameStartsSecondInjectionToken);
    const beforeMainFrameStartsSecond = runMany(tokens.beforeMainFrameStartsSecondInjectionToken);
    const beforeClusterFrameStartsSecond = runMany(tokens.beforeClusterFrameStartsSecondInjectionToken);
    const currentlyInClusterFrame = di.inject(currentlyInClusterFrameInjectable);

    return {
      run: async () => {
        await beforeFrameStartsFirst();

        // A chat's window is no application window: it skips the main frame's work.
        const inChatWindow = chatWindowChatId() !== undefined;

        if (currentlyInClusterFrame) {
          await beforeClusterFrameStartsFirst();
        } else if (!inChatWindow) {
          await beforeMainFrameStartsFirst();
        }

        await beforeFrameStartsSecond();

        if (currentlyInClusterFrame) {
          await beforeClusterFrameStartsSecond();
        } else if (!inChatWindow) {
          await beforeMainFrameStartsSecond();
        }
      },
    };
  },

  injectionToken: onLoadOfApplicationInjectionToken,
});

export default startFrameInjectable;
