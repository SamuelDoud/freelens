/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { observable } from "mobx";

import type { ExpandedRows } from "./expanded-rows";

/** The open rows of every list of the frame, by the list's table id */
const expandedRowsRegistryInjectable = getInjectable({
  id: "expanded-rows-registry",
  instantiate: () => observable.map<string, ExpandedRows>([], { deep: false }),
});

export default expandedRowsRegistryInjectable;
