/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { RuntimeClassesDetails } from "../../../config-runtime-classes";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const runtimeClassDetailItemInjectable = getInjectable({
  id: "runtime-class-detail-item",

  instantiate: () => ({
    Component: RuntimeClassesDetails,
    isFor: isRuntimeClass,
    orderNumber: 10,
  }),

  injectionToken: kubeObjectDetailItemInjectionToken,
});

const isRuntimeClass = kubeObjectMatchesToKindAndApiVersion("RuntimeClass", ["node.k8s.io/v1"]);

export default runtimeClassDetailItemInjectable;
