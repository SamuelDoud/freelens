/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { DeviceTaintRuleDetails } from "../../../devices-device-taint-rules";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const deviceTaintRuleDetailItemInjectable = getInjectable({
  id: "device-taint-rule-detail-item",

  instantiate(di) {
    return {
      Component: DeviceTaintRuleDetails,
      isFor: isDeviceTaintRule,
      orderNumber: 10,
    };
  },

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isDeviceTaintRule = kubeObjectMatchesToKindAndApiVersion("DeviceTaintRule", ["resource.k8s.io/v1"]);

export default deviceTaintRuleDetailItemInjectable;
