/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { EventDetails } from "../../../events";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const eventsDetailItemInjectable = getInjectable({
  id: "events-detail-item",

  instantiate: () => ({
    Component: EventDetails,
    isFor: isEvent,
    orderNumber: 10,
  }),

  injectionToken: kubeObjectDetailItemInjectionToken,
});

const isEvent = kubeObjectMatchesToKindAndApiVersion("Event", ["v1"]);

export default eventsDetailItemInjectable;
