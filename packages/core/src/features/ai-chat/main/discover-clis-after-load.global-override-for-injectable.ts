/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getGlobalOverride } from "@freelensapp/test-utils";
import discoverAiClisAfterLoadInjectable from "./discover-clis-after-load.injectable";

// Unit tests run no command-line agent: discovery would spawn through their fake spawn.
export default getGlobalOverride(discoverAiClisAfterLoadInjectable, () => ({ run: () => {} }));
