/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import path from "node:path";
import { getInjectable } from "@ogre-tools/injectable";
import directoryForUserDataInjectable from "../../../../common/app-paths/directory-for-user-data/directory-for-user-data.injectable";
import userPreferencesStateInjectable from "../../../user-preferences/common/state.injectable";
import { defaultAiChatPreferences } from "../../common/preferences";
import { SshAskpass } from "./ssh-askpass";
import aiSshPromptsInjectable from "./ssh-prompts.injectable";

const aiSshAskpassInjectable = getInjectable({
  id: "ai-chat-ssh-askpass",
  instantiate: (di) => {
    const prompts = di.inject(aiSshPromptsInjectable);
    const state = di.inject(userPreferencesStateInjectable);

    return new SshAskpass(path.join(di.inject(directoryForUserDataInjectable), "ai-ssh"), (prompt) =>
      prompts.ask({ ...prompt, host: (state.aiChat ?? defaultAiChatPreferences).remoteHost.destination }),
    );
  },
});

export default aiSshAskpassInjectable;
