/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { afterApplicationIsLoadedInjectionToken } from "@freelensapp/application";
import { getInjectable } from "@ogre-tools/injectable";
import { reaction } from "mobx";
import userPreferencesStateInjectable from "../../user-preferences/common/state.injectable";
import aiCliDiscoveryInjectable from "./cli-discovery.injectable";

// The CLIs are asked what they offer once the application has loaded, when the login shell's PATH
// is known, and again whenever the user points Freelens at another one of them.
const discoverAiClisAfterLoadInjectable = getInjectable({
  id: "discover-ai-clis-after-load",
  instantiate: (di) => ({
    run: () => {
      const discovery = di.inject(aiCliDiscoveryInjectable);
      const state = di.inject(userPreferencesStateInjectable);

      void discovery.refresh();
      reaction(
        () => [state.aiChat?.claudePath, state.aiChat?.codexPath, state.aiChat?.musePath].join("\0"),
        () => void discovery.refresh(),
      );
    },
  }),
  injectionToken: afterApplicationIsLoadedInjectionToken,
});

export default discoverAiClisAfterLoadInjectable;
