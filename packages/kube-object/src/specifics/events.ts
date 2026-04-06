/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { formatDuration } from "@freelensapp/utilities";
import moment from "moment";
import { KubeObject } from "../kube-object";

import type { KubeJsonApiData, KubeObjectMetadata, KubeObjectScope, ObjectReference } from "../api-types";

export interface EventSeries {
  count?: number;
  lastObservedTime?: string;
}

export interface EventSource {
  component?: string;
  host?: string;
}

export interface KubeEventData extends KubeJsonApiData<KubeObjectMetadata<KubeObjectScope.Namespace>, void, void> {
  action?: string;
  count?: number;
  eventTime?: string;
  firstTimestamp?: string;
  involvedObject: Required<ObjectReference>;
  lastTimestamp?: string;
  message?: string;
  reason?: string;
  related?: ObjectReference;
  reportingComponent?: string;
  reportingInstance?: string;
  series?: EventSeries;
  source?: EventSource;
  type?: string;
}

export class KubeEvent extends KubeObject<KubeObjectMetadata<KubeObjectScope.Namespace>, void, void> {
  static kind = "Event";

  static namespaced = true;

  static apiBase = "/api/v1/events";

  action?: string;

  count?: number;

  eventTime?: string;

  firstTimestamp?: string;

  involvedObject: Required<ObjectReference>;

  lastTimestamp?: string;

  message?: string;

  reason?: string;

  related?: ObjectReference;

  reportingComponent?: string;

  reportingInstance?: string;

  series?: EventSeries;

  source?: EventSource;

  /**
   * Current supported values are:
   * - "Normal"
   * - "Warning"
   */
  type?: string;

  constructor(data: KubeEventData) {
    super(data);
    this.action = data.action;
    this.count = data.count;
    this.eventTime = data.eventTime;
    this.firstTimestamp = data.firstTimestamp;
    this.involvedObject = data.involvedObject;
    this.lastTimestamp = data.lastTimestamp;
    this.message = data.message;
    this.reason = data.reason;
    this.related = data.related;
    this.reportingComponent = data.reportingComponent;
    this.reportingInstance = data.reportingInstance;
    this.series = data.series;
    this.source = data.source;
    this.type = data.type;
  }

  isWarning() {
    return this.type === "Warning";
  }

  getSource() {
    if (!this.source?.component) {
      return "<unknown>";
    }

    const { component, host = "" } = this.source;

    return `${component} ${host}`;
  }

  /**
   * @deprecated This function is not reactive to changing of time. If rendering use `<ReactiveDuration />` instead
   */
  getFirstSeenTime() {
    const diff = moment().diff(this.firstTimestamp);

    return formatDuration(diff, true);
  }

  /**
   * @deprecated This function is not reactive to changing of time. If rendering use `<ReactiveDuration />` instead
   */
  getLastSeenTime() {
    const diff = moment().diff(this.lastTimestamp);

    return formatDuration(diff, true);
  }
}
