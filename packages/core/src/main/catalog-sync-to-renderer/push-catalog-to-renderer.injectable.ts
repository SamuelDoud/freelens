/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { asPlainPayload } from "../../common/ipc/ipc";
import { toJS } from "../../common/utils";
import catalogEntityRegistryInjectable from "../catalog/entity-registry.injectable";
import catalogSyncBroadcasterInjectable from "./broadcaster.injectable";

const pushCatalogToRendererInjectable = getInjectable({
  id: "push-catalog-to-renderer",
  instantiate: (di) => {
    const catalogEntityRegistry = di.inject(catalogEntityRegistryInjectable);
    const catalogSyncBroadcaster = di.inject(catalogSyncBroadcasterInjectable);

    return () => catalogSyncBroadcaster(asPlainPayload(toJS(catalogEntityRegistry.items)));
  },
});

export default pushCatalogToRendererInjectable;
