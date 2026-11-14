/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { sendMessageToChannelInjectionToken } from "@freelensapp/messaging";
import { getInjectable } from "@ogre-tools/injectable";
import { historyGoChannel } from "../../../../../history/common/channels";
import applicationMenuItemInjectionToken from "../../application-menu-item-injection-token";

const goForwardMenuItemInjectable = getInjectable({
  id: "go-forward-menu-item",

  instantiate: (di) => ({
    kind: "clickable-menu-item" as const,
    parentId: "view",
    id: "go-forward",
    orderNumber: 50,
    label: "Forward",
    keyboardShortcut: "CmdOrCtrl+]",

    // Steps through the timeline of the main frame, which counts the steps within pages too.
    onClick: () => di.inject(sendMessageToChannelInjectionToken)(historyGoChannel, 1),
  }),

  injectionToken: applicationMenuItemInjectionToken,
});

export default goForwardMenuItemInjectable;
