/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectionToken } from "@ogre-tools/injectable";

import type { KubeObject } from "@freelensapp/kube-object";

import type React from "react";

import type { KubeObjectDetailsProps } from "../kube-object-details";

export interface KubeObjectDetailItem {
  Component: React.ElementType<KubeObjectDetailsProps<any>>;
  /**
   * Whether the item shows for an object: in the drawer for the object in the URL, under a row for
   * that row's object. Observables it reads keep the views up to date.
   */
  isFor: (object: KubeObject) => boolean;
  orderNumber: number;
}

export const kubeObjectDetailItemInjectionToken = getInjectionToken<KubeObjectDetailItem>({
  id: "kube-object-detail-item-injection-token",
});
