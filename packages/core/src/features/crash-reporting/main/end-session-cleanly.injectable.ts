/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { onQuitOfBackEndInjectionToken } from "../../../main/start-main-application/runnable-tokens/phases";
import crashStoreInjectable from "./crash-store.injectable";

const endSessionCleanlyInjectable = getInjectable({
  id: "end-session-cleanly-on-quit",

  instantiate: (di) => ({
    run: () => {
      di.inject(crashStoreInjectable).endSessionCleanly();
    },
  }),

  injectionToken: onQuitOfBackEndInjectionToken,
});

export default endSessionCleanlyInjectable;
