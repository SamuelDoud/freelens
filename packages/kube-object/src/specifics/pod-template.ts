/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import autoBind from "auto-bind";
import { KubeObject } from "../kube-object";

import type { KubeJsonApiData, NamespaceScopedMetadata } from "../api-types";

export interface PodTemplateContainer {
  name: string;
  image?: string;
}

export interface PodTemplateTemplate {
  metadata?: { labels?: Partial<Record<string, string>>; annotations?: Partial<Record<string, string>> };
  spec?: { containers?: PodTemplateContainer[]; initContainers?: PodTemplateContainer[]; [key: string]: unknown };
}

export interface PodTemplateData extends KubeJsonApiData<NamespaceScopedMetadata, void, void> {
  template?: PodTemplateTemplate;
}

export class PodTemplate extends KubeObject<NamespaceScopedMetadata, void, void> {
  static readonly kind = "PodTemplate";

  static readonly namespaced = true;

  static readonly apiBase = "/api/v1/podtemplates";

  template: PodTemplateTemplate | undefined;

  constructor({ template, ...rest }: PodTemplateData) {
    super(rest);
    autoBind(this);
    this.template = template;
  }

  getContainers(): PodTemplateContainer[] {
    return this.template?.spec?.containers ?? [];
  }
}
