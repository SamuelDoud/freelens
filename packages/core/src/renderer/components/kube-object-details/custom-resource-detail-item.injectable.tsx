/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { observer } from "mobx-react";
import customResourceDefinitionStoreInjectable from "../custom-resource-definitions/store.injectable";
import { CustomResourceDetails } from "../custom-resources/details";
import discoveredCustomResourcesInjectable from "../custom-resources/discovered-custom-resources.injectable";
import { kubeObjectDetailItemInjectionToken } from "./kube-object-detail-items/kube-object-detail-item-injection-token";

import type { KubeObject } from "@freelensapp/kube-object";

import type { KubeObjectDetailsProps } from "./kube-object-details";

const customResourceDetailItemInjectable = getInjectable({
  id: "custom-resource-detail-item",
  instantiate: (di) => {
    const customResourceDefinitionStore = di.inject(customResourceDefinitionStoreInjectable);
    const discoveredCustomResources = di.inject(discoveredCustomResourcesInjectable);
    // Without its definition, an object of a custom resource known from
    // discovery gets the details that need none.
    const isDiscoveredCustomResource = (object: KubeObject) =>
      discoveredCustomResources
        .get()
        .some(({ group, version, kind }) => object.kind === kind && object.apiVersion === `${group}/${version}`);

    return {
      Component: observer(({ object }: KubeObjectDetailsProps) => (
        <CustomResourceDetails object={object} crd={customResourceDefinitionStore.getByObject(object)} />
      )),
      isFor: (object) =>
        Boolean(customResourceDefinitionStore.getByObject(object)) || isDiscoveredCustomResource(object),
      orderNumber: 100,
    };
  },
  injectionToken: kubeObjectDetailItemInjectionToken,
});

export default customResourceDetailItemInjectable;
