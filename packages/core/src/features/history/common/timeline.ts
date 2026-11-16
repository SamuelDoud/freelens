/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { action, computed, makeObservable, observable } from "mobx";

import type { ClusterViewState } from "./channels";

export interface TimelineEntry {
  /** The path of the main frame */
  readonly rootPath: string;
  /** The cluster the main frame shows, if it shows one */
  readonly clusterId?: string;
  /** What the cluster's view showed */
  readonly cluster?: ClusterViewState;
}

const maxEntries = 200;

/** What makes two entries different steps: everything but the scroll position */
const keyOf = ({ rootPath, clusterId, cluster }: TimelineEntry) =>
  JSON.stringify([rootPath, clusterId, cluster && [cluster.path, cluster.namespaces, cluster.expanded]]);

/** Whether two views of a cluster are the same step: they differ at most in their scroll position */
export const isSameView = (a: ClusterViewState, b: ClusterViewState) =>
  JSON.stringify([a.path, a.namespaces, a.expanded]) === JSON.stringify([b.path, b.namespaces, b.expanded]);

/**
 * The steps the user took, between pages and within them, in order. Going
 * back and forward moves through them; a new step drops the ones ahead.
 */
export class Timeline {
  readonly entries = observable.array<TimelineEntry>([], { deep: false });
  index = -1;

  constructor() {
    makeObservable(this, {
      index: observable,
      current: computed,
      record: action,
      go: action,
    });
  }

  get current(): TimelineEntry | undefined {
    return this.entries[this.index];
  }

  canGo(delta: number): boolean {
    const target = this.index + delta;

    return delta !== 0 && target >= 0 && target < this.entries.length;
  }

  /**
   * Records a step. One that differs from the current only in its scroll
   * position, or that `replace` says belongs to it, updates it instead.
   */
  record(entry: TimelineEntry, { replace = false } = {}): void {
    const current = this.current;

    if (current && (replace || keyOf(current) === keyOf(entry))) {
      this.entries[this.index] = entry;

      return;
    }

    this.entries.splice(this.index + 1);
    this.entries.push(entry);

    if (this.entries.length > maxEntries) {
      this.entries.splice(0, this.entries.length - maxEntries);
    }

    this.index = this.entries.length - 1;
  }

  /** Moves `delta` steps and returns the entry there, or nothing when there is none. */
  go(delta: number): TimelineEntry | undefined {
    if (!this.canGo(delta)) {
      return undefined;
    }

    this.index += delta;

    return this.current;
  }

  /** The entries behind (negative) or ahead (positive) of the current one, nearest first, with their distance. */
  around(direction: -1 | 1, limit = 15): { delta: number; entry: TimelineEntry }[] {
    const steps: { delta: number; entry: TimelineEntry }[] = [];

    for (let delta = direction; this.canGo(delta) && steps.length < limit; delta += direction) {
      steps.push({ delta, entry: this.entries[this.index + delta] });
    }

    return steps;
  }
}

const titleOf = (segment: string) =>
  segment
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");

/** A short label for an entry, for the list of steps: "Pods · details of nginx-1" */
export function describeEntry(entry: TimelineEntry, clusterName?: (id: string) => string | undefined): string {
  if (!entry.cluster) {
    const segment = entry.rootPath.split("/").filter(Boolean)[0] ?? "welcome";

    return titleOf(segment);
  }

  const url = new URL(entry.cluster.path, "https://cluster");
  const segments = url.pathname.split("/").filter(Boolean);
  const view = titleOf(segments[segments.length - 1] ?? "overview");
  const details = url.searchParams.get("kube-details")?.split("/").pop();
  const search = url.searchParams.get("search");
  const expanded = Object.values(entry.cluster.expanded).flat().length;
  const { namespaces } = entry.cluster;
  const parts = [
    view,
    namespaces.length > 0 &&
      (namespaces.length <= 2 ? `in ${namespaces.join(", ")}` : `in ${namespaces.length} namespaces`),
    details && `details of ${details}`,
    search && `search "${search}"`,
    expanded > 0 && `${expanded} row${expanded === 1 ? "" : "s"} open`,
  ].filter(Boolean);
  const name = entry.clusterId && clusterName?.(entry.clusterId);

  return `${name ? `${name}: ` : ""}${parts.join(" · ")}`;
}
