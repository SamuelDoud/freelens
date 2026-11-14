/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { byValue } from "@freelensapp/utilities";
import { getInjectable } from "@ogre-tools/injectable";
import { computedInjectManyInjectionToken } from "@ogre-tools/injectable-extension-for-mobx";
import { kubeObjectDetailItemInjectionToken } from "./kube-object-detail-item-injection-token";

import type { KubeObject } from "@freelensapp/kube-object";

import type React from "react";

import type { KubeObjectDetailsProps } from "../kube-object-details";

/** The detail components for an object, in their order. */
export type GetKubeObjectDetailItems = (object: KubeObject) => React.ElementType<KubeObjectDetailsProps<any>>[];

const kubeObjectDetailItemsInjectable = getInjectable({
  id: "kube-object-detail-items",

  instantiate: (di): GetKubeObjectDetailItems => {
    const computedInjectMany = di.inject(computedInjectManyInjectionToken);
    const items = computedInjectMany(kubeObjectDetailItemInjectionToken);

    return (object: KubeObject): React.ElementType<KubeObjectDetailsProps<any>>[] =>
      items
        .get()
        .filter((item) => item.isFor(object))
        .sort(byValue((item) => item.orderNumber))
        .map((item) => item.Component);
  },
});

export default kubeObjectDetailItemsInjectable;
