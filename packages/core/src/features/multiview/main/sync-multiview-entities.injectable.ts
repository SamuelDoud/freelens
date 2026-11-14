/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { onLoadOfApplicationInjectionToken } from "@freelensapp/application";
import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import { GeneralEntity } from "../../../common/catalog-entities";
import catalogEntityRegistryInjectable from "../../../main/catalog/entity-registry.injectable";
import userPreferencesStateInjectable from "../../user-preferences/common/state.injectable";
import { multiViewEntityId, multiViewPath, multiViewSettingsPath } from "../common/multiview";

const layoutIcons = { columns: "view_column", rows: "view_agenda", grid: "grid_view" } as const;

/**
 * Puts every multiview in the catalog, as a General entity that opens it, so
 * that it can be pinned to the cluster bar and edited from its menu.
 */
const syncMultiViewEntitiesInjectable = getInjectable({
  id: "sync-multiview-entities",
  instantiate: (di) => ({
    run: () => {
      const state = di.inject(userPreferencesStateInjectable);
      const registry = di.inject(catalogEntityRegistryInjectable);

      registry.addComputedSource(
        "freelens:multiviews",
        computed(() =>
          (state.multiviews ?? []).map(
            (view) =>
              new GeneralEntity({
                metadata: {
                  uid: multiViewEntityId(view.id),
                  name: view.name,
                  shortName: view.iconText,
                  description: `${view.clusterIds.length} clusters`,
                  source: "app",
                  labels: { "freelens.app/multiview": "true" },
                },
                spec: {
                  path: multiViewPath(view.id),
                  settingsPath: multiViewSettingsPath(view.id),
                  icon: {
                    // Text, when the user gave some, shows instead of the layout's icon.
                    material: view.iconText ? undefined : layoutIcons[view.layout],
                    background: view.iconBackground || "var(--primary)",
                  },
                },
                status: { phase: "active" },
              }),
          ),
        ),
      );
    },
  }),
  injectionToken: onLoadOfApplicationInjectionToken,
});

export default syncMultiViewEntitiesInjectable;
