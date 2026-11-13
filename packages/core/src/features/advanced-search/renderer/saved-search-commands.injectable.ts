/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import { isKubernetesClusterActive } from "../../../renderer/components/command-palette/registered-commands/internal-commands.injectable";
import currentlyInClusterFrameInjectable from "../../../renderer/routes/currently-in-cluster-frame.injectable";
import advancedSearchStateInjectable from "./advanced-search-state.injectable";
import savedSearchesInjectable from "./saved-searches.injectable";

import type { IComputedValue } from "mobx";

import type { CommandRegistration } from "../../../renderer/components/command-palette/registered-commands/commands";

/**
 * One command-palette entry per saved search, which opens the list the search
 * belongs to with its conditions in place. The conditions live in the cluster
 * frame, so the entries are offered there only.
 */
const savedSearchCommandsInjectable = getInjectable({
  id: "saved-search-commands",

  instantiate: (di): IComputedValue<CommandRegistration[]> => {
    const savedSearches = di.inject(savedSearchesInjectable);
    const state = di.inject(advancedSearchStateInjectable);
    const inClusterFrame = di.inject(currentlyInClusterFrameInjectable);

    return computed(() =>
      savedSearches.all.map(
        (search): CommandRegistration => ({
          id: `saved-search.${search.id}`,
          title: `Saved search: ${search.name} (${search.viewTitle})`,
          isActive: (context) => inClusterFrame && isKubernetesClusterActive(context),
          action: ({ navigate }) => {
            state.setConditions(search.viewKey, search.conditions);
            navigate(search.routePath);
          },
        }),
      ),
    );
  },
});

export default savedSearchCommandsInjectable;
