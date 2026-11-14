/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import autoBind from "auto-bind";
import { KubeObject } from "../kube-object";

import type { ClusterScopedMetadata, KubeJsonApiData } from "../api-types";

export interface VolumeAttributesClassData extends KubeJsonApiData<ClusterScopedMetadata, void, void> {
  driverName?: string;
  parameters?: Partial<Record<string, string>>;
}

export class VolumeAttributesClass extends KubeObject<ClusterScopedMetadata, void, void> {
  static readonly kind = "VolumeAttributesClass";

  static readonly namespaced = false;

  static readonly apiBase = "/apis/storage.k8s.io/v1/volumeattributesclasses";

  driverName: string;

  parameters: Partial<Record<string, string>>;

  constructor({ driverName = "", parameters = {}, ...rest }: VolumeAttributesClassData) {
    super(rest);
    autoBind(this);
    this.driverName = driverName;
    this.parameters = parameters;
  }
}
