/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { ConfigMapDetails } from "../../../config-maps";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const configMapDetailItemInjectable = getInjectable({
  id: "config-map-detail-item",

  instantiate: () => ({
    Component: ConfigMapDetails,
    isFor: isConfigMap,
    orderNumber: 10,
  }),

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export default configMapDetailItemInjectable;

const isConfigMap = kubeObjectMatchesToKindAndApiVersion("ConfigMap", ["v1"]);
