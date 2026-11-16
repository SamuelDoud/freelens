/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { formatDuration } from "@freelensapp/utilities";
import { capitalize } from "es-toolkit";
import { getMillisecondsFromUnixEpoch } from "../../../common/utils/date/get-current-date-time";

import type { HelmRelease } from "../../../common/k8s-api/endpoints/helm-releases.api";
import type { ListedHelmRelease } from "../../../features/helm-releases/common/channels";

/**
 * `updated` as a Date's time, in milliseconds. Go prints `2019-11-26 10:58:09 +0300 MSK`, and a zone without an
 * abbreviation as its offset, `2019-11-26 10:58:09 +0300 +03`; the name after the offset is not part of what Date
 * parses.
 */
export const parseHelmUpdated = (updated: string) =>
  new Date(updated.replace(/(?<=[+-]\d{4})\s(?:[A-Za-z]+|[+-]\d+)$/, "")).getTime();

export const toHelmRelease = (release: ListedHelmRelease): HelmRelease => ({
  appVersion: release.app_version,
  chart: release.chart,
  namespace: release.namespace,
  revision: release.revision,
  status: release.status,
  name: release.name,
  updated: release.updated,

  getId() {
    return `${this.namespace}/${this.name}`;
  },

  getName() {
    return this.name;
  },

  getNs() {
    return this.namespace;
  },

  getChart(withVersion = false) {
    let chart = this.chart;

    const version = this.getVersion();

    // The version is text, not a pattern: "+" and "." in it must match literally.
    if (!withVersion && version !== "" && chart.endsWith(`-${version}`)) {
      chart = chart.slice(0, -(version.length + 1));
    }

    return chart;
  },

  getRevision() {
    return parseInt(this.revision, 10);
  },

  getStatus() {
    return capitalize(this.status);
  },

  getVersion() {
    const versions = this.chart.match(/(?<=-)(v?\d+)[^-].*$/);

    return versions?.[0] ?? "";
  },

  getUpdated(humanize = true, compact = true) {
    const updatedDate = parseHelmUpdated(this.updated);
    const diff = getMillisecondsFromUnixEpoch() - updatedDate;

    if (humanize) {
      return formatDuration(diff, compact);
    }

    return diff;
  },
});
