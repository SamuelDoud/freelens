/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { FlowSchemaDetails } from "../../../config-flow-schemas";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const flowSchemaDetailItemInjectable = getInjectable({
  id: "flow-schema-detail-item",

  instantiate(di) {
    return {
      Component: FlowSchemaDetails,
      isFor: isFlowSchema,
      orderNumber: 10,
    };
  },

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export const isFlowSchema = kubeObjectMatchesToKindAndApiVersion("FlowSchema", ["flowcontrol.apiserver.k8s.io/v1"]);

export default flowSchemaDetailItemInjectable;
