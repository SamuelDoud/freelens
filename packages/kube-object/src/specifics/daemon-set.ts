/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeObject } from "../kube-object";

import type { KubeObjectStatus, LabelSelector, NamespaceScopedMetadata } from "../api-types";
import type { PodTemplateSpec } from "../types/pod-template-spec";

export interface RollingUpdateDaemonSet {
  maxUnavailable?: number | string;
  maxSurge?: number | string;
}

export interface DaemonSetUpdateStrategy {
  type: string;
  rollingUpdate: RollingUpdateDaemonSet;
}

export interface DaemonSetSpec {
  selector: LabelSelector;
  template: PodTemplateSpec;
  updateStrategy: DaemonSetUpdateStrategy;
  minReadySeconds?: number;
  revisionHistoryLimit?: number;
}

export interface DaemonSetStatus extends KubeObjectStatus {
  collisionCount?: number;
  currentNumberScheduled: number;
  desiredNumberScheduled: number;
  numberAvailable?: number;
  numberMisscheduled: number;
  numberReady: number;
  numberUnavailable?: number;
  observedGeneration?: number;
  updatedNumberScheduled?: number;
}

export class DaemonSet extends KubeObject<NamespaceScopedMetadata, DaemonSetStatus, DaemonSetSpec> {
  static kind = "DaemonSet";

  static namespaced = true;

  static apiBase = "/apis/apps/v1/daemonsets";

  private cachedSelectors?: string[];
  private cachedNodeSelectors?: string[];
  private cachedTemplateLabels?: string[];

  getSelectors(): string[] {
    return (this.cachedSelectors ??= KubeObject.stringifyLabels(this.spec.selector.matchLabels));
  }

  getNodeSelectors(): string[] {
    return (this.cachedNodeSelectors ??= KubeObject.stringifyLabels(this.spec.template.spec?.nodeSelector));
  }

  getTemplateLabels(): string[] {
    return (this.cachedTemplateLabels ??= KubeObject.stringifyLabels(this.spec.template.metadata?.labels));
  }

  getTolerations() {
    return this.spec.template.spec?.tolerations ?? [];
  }

  getAffinity() {
    return this.spec.template.spec?.affinity;
  }

  getAffinityNumber() {
    return Object.keys(this.getAffinity() ?? {}).length;
  }

  getImages() {
    const containers = this.spec.template?.spec?.containers ?? [];
    const initContainers = this.spec.template?.spec?.initContainers ?? [];

    return [...containers, ...initContainers].map((container) => container.image);
  }
}
