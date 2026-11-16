/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getGlobalOverride } from "@freelensapp/test-utils";
import freelensProxyPreferredPortInjectable from "./freelens-proxy-preferred-port.injectable";

export default getGlobalOverride(freelensProxyPreferredPortInjectable, () => ({
  get: async () => undefined,
  save: async () => {},
}));
