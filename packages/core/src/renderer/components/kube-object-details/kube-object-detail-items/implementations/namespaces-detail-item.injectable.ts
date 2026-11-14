/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { NamespaceDetails } from "../../../namespaces";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const namespacesDetailItemInjectable = getInjectable({
  id: "namespaces-detail-item",

  instantiate: () => ({
    Component: NamespaceDetails,
    isFor: isNamespace,
    orderNumber: 10,
  }),

  injectionToken: kubeObjectDetailItemInjectionToken,
});

const isNamespace = kubeObjectMatchesToKindAndApiVersion("Namespace", ["v1"]);

export default namespacesDetailItemInjectable;
