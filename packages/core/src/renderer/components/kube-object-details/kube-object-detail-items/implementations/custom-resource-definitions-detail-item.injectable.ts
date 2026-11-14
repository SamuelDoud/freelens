/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { CustomResourceDefinitionDetails } from "../../../custom-resource-definitions/details";
import { kubeObjectDetailItemInjectionToken } from "../kube-object-detail-item-injection-token";
import { kubeObjectMatchesToKindAndApiVersion } from "../kube-object-matches-to-kind-and-api-version";

const customResourceDefinitionsDetailItemInjectable = getInjectable({
  id: "custom-resource-definitions-detail-item",

  instantiate: () => ({
    Component: CustomResourceDefinitionDetails,
    isFor: isCustomResourceDefinition,
    orderNumber: 10,
  }),

  injectionToken: kubeObjectDetailItemInjectionToken,
});

export default customResourceDefinitionsDetailItemInjectable;

const isCustomResourceDefinition = kubeObjectMatchesToKindAndApiVersion("CustomResourceDefinition", [
  "apiextensions.k8s.io/v1",
  "apiextensions.k8s.io/v1beta1",
]);
