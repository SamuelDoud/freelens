/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { ControllerRevisionDetails } from "../../../workloads-controller-revisions";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const controllerRevisionDetailItemInjectable = getInjectable({
  id: "controller-revision-detail-item",

  instantiate(di) {
    return {
      Component: ControllerRevisionDetails,
      isFor: isControllerRevision,
      orderNumber: 10,
    };
  },

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isControllerRevision = kubeObjectMatchesToKindAndApiVersion("ControllerRevision", ["apps/v1"]);

export default controllerRevisionDetailItemInjectable;
