/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { sidebarItemInjectionToken } from "@freelensapp/cluster-sidebar";
import { getInjectable } from "@ogre-tools/injectable";
import navigateToStorageVersionMigrationsInjectable from "../../../common/front-end-routing/routes/cluster/config/storage-version-migrations/navigate-to-storage-version-migrations.injectable";
import storageVersionMigrationsRouteInjectable from "../../../common/front-end-routing/routes/cluster/config/storage-version-migrations/storage-version-migrations-route.injectable";
import routeIsActiveInjectable from "../../routes/route-is-active.injectable";
import configSidebarItemInjectable from "../config/config-sidebar-item.injectable";

const storageVersionMigrationsSidebarItemInjectable = getInjectable({
  id: "sidebar-item-storage-version-migrations",

  instantiate: (di) => {
    const route = di.inject(storageVersionMigrationsRouteInjectable);

    return {
      parentId: configSidebarItemInjectable.id,
      title: "Storage Version Migrations",
      onClick: di.inject(navigateToStorageVersionMigrationsInjectable),
      isActive: di.inject(routeIsActiveInjectable, route),
      isVisible: route.isEnabled,
      orderNumber: 180,
    };
  },

  injectionToken: sidebarItemInjectionToken,
});

export default storageVersionMigrationsSidebarItemInjectable;
