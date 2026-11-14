/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import { DeviceTaintRuleDetails } from "../../../devices-device-taint-rules";
import currentKubeObjectInDetailsInjectable from "../../current-kube-object-in-details.injectable";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const deviceTaintRuleDetailItemInjectable = getInjectable({
  id: "device-taint-rule-detail-item",

  instantiate(di) {
    const kubeObject = di.inject(currentKubeObjectInDetailsInjectable);

    return {
      Component: DeviceTaintRuleDetails,
      enabled: computed(() => isDeviceTaintRule(kubeObject.value.get()?.object)),
      orderNumber: 10,
    };
  },

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isDeviceTaintRule = kubeObjectMatchesToKindAndApiVersion("DeviceTaintRule", ["resource.k8s.io/v1"]);

export default deviceTaintRuleDetailItemInjectable;
