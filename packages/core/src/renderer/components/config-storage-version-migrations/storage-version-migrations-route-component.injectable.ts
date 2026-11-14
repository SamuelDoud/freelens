/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import storageVersionMigrationsRouteInjectable from "../../../common/front-end-routing/routes/cluster/config/storage-version-migrations/storage-version-migrations-route.injectable";
import { routeSpecificComponentInjectionToken } from "../../routes/route-specific-component-injection-token";
import { StorageVersionMigrations } from "./storage-version-migrations";

const storageVersionMigrationsRouteComponentInjectable = getInjectable({
  id: "storage-version-migrations-route-component",

  instantiate: (di) => ({
    route: di.inject(storageVersionMigrationsRouteInjectable),
    Component: StorageVersionMigrations,
  }),

  injectionToken: routeSpecificComponentInjectionToken,
});

export default storageVersionMigrationsRouteComponentInjectable;
