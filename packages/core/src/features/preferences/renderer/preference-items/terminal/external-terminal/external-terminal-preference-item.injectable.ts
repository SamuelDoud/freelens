/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { preferenceItemInjectionToken } from "../../preference-item-injection-token";
import { ExternalTerminal } from "./external-terminal";

const externalTerminalPreferenceItemInjectable = getInjectable({
  id: "external-terminal-preference-item",

  instantiate: () => ({
    kind: "block" as const,
    id: "external-terminal-preference-item",
    parentId: "terminal-page",
    orderNumber: 30,
    Component: ExternalTerminal,
  }),

  injectionToken: preferenceItemInjectionToken,
});

export default externalTerminalPreferenceItemInjectable;
