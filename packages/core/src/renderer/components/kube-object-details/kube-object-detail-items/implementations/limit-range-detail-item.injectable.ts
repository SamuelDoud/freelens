/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { LimitRangeDetails } from "../../../config-limit-ranges";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const limitRangeDetailItemInjectable = getInjectable({
  id: "limit-range-detail-item",

  instantiate: () => ({
    Component: LimitRangeDetails,
    isFor: isLimitRange,
    orderNumber: 10,
  }),

  injectionToken: kubeObjectDetailItemInjectionToken,
});

const isLimitRange = kubeObjectMatchesToKindAndApiVersion("LimitRange", ["v1"]);

export default limitRangeDetailItemInjectable;
