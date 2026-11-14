/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import { ExpandedRows } from "./expanded-rows";

const prefersReducedMotion = () =>
  typeof globalThis.matchMedia !== "function" || globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The open rows of a list, by its table id, for as long as the cluster frame lives. */
const expandedRowsInjectable = getInjectable({
  id: "expanded-rows",
  instantiate: () =>
    new ExpandedRows({
      now: () => globalThis.performance.now(),
      requestFrame: (callback) => globalThis.requestAnimationFrame(callback),
      reducedMotion: prefersReducedMotion,
    }),
  lifecycle: lifecycleEnum.keyedSingleton({
    getInstanceKey: (di, tableId: string) => tableId,
  }),
});

export default expandedRowsInjectable;
