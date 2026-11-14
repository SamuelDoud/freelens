/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { clusterFrameChildComponentInjectionToken } from "@freelensapp/react-application";
import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import { DefinitionHover } from "./definition-hover";

const definitionHoverChildComponentInjectable = getInjectable({
  id: "resource-definition-hover-child-component",
  instantiate: () => ({
    id: "resource-definition-hover",
    shouldRender: computed(() => true),
    Component: DefinitionHover,
  }),
  injectionToken: clusterFrameChildComponentInjectionToken,
});

export default definitionHoverChildComponentInjectable;
