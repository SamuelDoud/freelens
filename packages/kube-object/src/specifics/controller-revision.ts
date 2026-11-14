/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import autoBind from "auto-bind";
import { KubeObject } from "../kube-object";

import type { KubeJsonApiData, NamespaceScopedMetadata } from "../api-types";

export interface ControllerRevisionData extends KubeJsonApiData<NamespaceScopedMetadata, void, void> {
  revision?: number;
  data?: unknown;
}

export class ControllerRevision extends KubeObject<NamespaceScopedMetadata, void, void> {
  static readonly kind = "ControllerRevision";

  static readonly namespaced = true;

  static readonly apiBase = "/apis/apps/v1/controllerrevisions";

  revision: number;

  data: unknown;

  constructor({ revision = 0, data, ...rest }: ControllerRevisionData) {
    super(rest);
    autoBind(this);
    this.revision = revision;
    this.data = data;
  }

  getController(): string {
    const owner = this.getOwnerRefs().find((ref) => ref.controller) ?? this.getOwnerRefs()[0];

    return owner ? `${owner.kind}/${owner.name}` : "";
  }
}
