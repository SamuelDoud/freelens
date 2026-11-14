/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { podListLayoutColumnInjectionToken } from "@freelensapp/list-layout";
import { getInjectable } from "@ogre-tools/injectable";
import { COLUMN_PRIORITY } from "./column-priority";
import { createPodResourceColumn } from "./pods-resource-column";

export const podsMemoryRequestColumnInjectable = getInjectable({
  id: "pods-memory-request-column",
  instantiate: () => createPodResourceColumn("memoryRequest", COLUMN_PRIORITY.MEMORY_REQUEST),
  injectionToken: podListLayoutColumnInjectionToken,
});
