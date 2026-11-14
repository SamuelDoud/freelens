/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import customResourceDefinitionsInjectable from "../../../renderer/components/custom-resource-definitions/definitions.injectable";
import { sideBarItemCustomResourcePrefix } from "../../../renderer/components/custom-resource-definitions/groups-sidebar-items-computed.injectable";
import { resourceDefinitions } from "../common/definitions";

import type { ResourceDefinition } from "../common/definitions";

export type GetResourceDefinition = (id: string) => ResourceDefinition | undefined;

/**
 * The definition of a sidebar item: the one Freelens writes for a built-in view, or, for a custom
 * resource, the description its CustomResourceDefinition gives its schema.
 */
const getResourceDefinitionInjectable = getInjectable({
  id: "get-resource-definition",
  instantiate: (di): GetResourceDefinition => {
    const customResourceDefinitions = di.inject(customResourceDefinitionsInjectable);

    return (id) => {
      const builtIn = resourceDefinitions[id];

      if (builtIn) {
        return builtIn;
      }

      if (!id.startsWith(`${sideBarItemCustomResourcePrefix}-`)) {
        return undefined;
      }

      const rest = id.slice(sideBarItemCustomResourcePrefix.length + 1);
      const slash = rest.indexOf("/");

      if (slash < 0) {
        return { text: `The custom resources of the API group ${rest}.` };
      }

      const group = rest.slice(0, slash);
      const plural = rest.slice(slash + 1);
      const definition = customResourceDefinitions
        .get()
        .find((crd) => crd.getGroup() === group && crd.getPluralName() === plural);

      if (!definition) {
        return undefined;
      }

      let description: string | undefined;

      try {
        description = definition.getPreferredVersion().schema?.openAPIV3Schema?.description;
      } catch {
        description = undefined;
      }

      return {
        text: description?.trim() || `A custom resource of the API group ${group}. Its definition has no description.`,
        kind: definition.getResourceKind(),
        scope: definition.getScope(),
      };
    };
  },
});

export default getResourceDefinitionInjectable;
