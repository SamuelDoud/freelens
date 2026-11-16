/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { KubeEvent } from "@freelensapp/kube-object";

/** The events kept for one involved object, and the most the store holds. */
export const maxEventsPerObject = 50;
export const maxEvents = 10_000;

const timeOf = (value: string | undefined) => {
  const time = value ? Date.parse(value) : Number.NaN;

  return Number.isNaN(time) ? undefined : time;
};

/** When the event last had news: its last timestamp, or its creation. */
const recencyOf = (event: KubeEvent) =>
  Math.max(timeOf(event.lastTimestamp) ?? 0, timeOf(event.metadata.creationTimestamp) ?? 0);

/**
 * Cluster Issues shows, for an object, the first of its newest-created
 * Warning events, and the pod list the Warning with the latest timestamp
 * (`lastTimestamp`, else the creation). Both are kept whatever their age.
 */
function pinnedWarnings(events: KubeEvent[]): Set<KubeEvent> {
  const pinned = new Set<KubeEvent>();
  let newestCreated: KubeEvent | undefined;
  let newestCreatedTime = Number.NEGATIVE_INFINITY;
  let latest: KubeEvent | undefined;
  let latestTime = Number.NEGATIVE_INFINITY;

  for (const event of events) {
    if (event.type !== "Warning") {
      continue;
    }

    const created = event.getCreationTimestamp();

    if (created > newestCreatedTime) {
      newestCreatedTime = created;
      newestCreated = event;
    }

    const time = event.lastTimestamp ? Date.parse(event.lastTimestamp) : created;

    if (time > latestTime) {
      latestTime = time;
      latest = event;
    }
  }

  if (newestCreated) pinned.add(newestCreated);
  if (latest) pinned.add(latest);

  return pinned;
}

/**
 * Bounds the events a store holds, and keeps the order of what it keeps.
 *
 * An involved object keeps its `perObject` most recently active events
 * (recency: the later of last timestamp and creation, so an event that keeps
 * recurring is not dropped for its old creation), and its pinned Warnings on
 * top of them. Then the store keeps its `overall` most recently active
 * events. Everything else is dropped; an event that is dropped and arrives
 * again is dropped again.
 *
 * Returns the given array itself when nothing needs to go.
 */
export function capEvents(events: KubeEvent[], perObject = maxEventsPerObject, overall = maxEvents): KubeEvent[] {
  const groups = new Map<string, KubeEvent[]>();
  let crowded = false;

  for (const event of events) {
    const uid = event.involvedObject.uid;
    const group = groups.get(uid);

    if (group) {
      group.push(event);
      crowded ||= group.length > perObject;
    } else {
      groups.set(uid, [event]);
    }
  }

  if (!crowded && events.length <= overall) {
    return events;
  }

  const recency = new Map<KubeEvent, number>();
  const dropped = new Set<KubeEvent>();

  for (const event of events) {
    recency.set(event, recencyOf(event));
  }

  const byRecency = (left: KubeEvent, right: KubeEvent) => recency.get(right)! - recency.get(left)!;

  if (crowded) {
    for (const group of groups.values()) {
      if (group.length <= perObject) {
        continue;
      }

      const pinned = pinnedWarnings(group);
      const kept = new Set([...group].sort(byRecency).slice(0, perObject));

      for (const event of group) {
        if (!kept.has(event) && !pinned.has(event)) {
          dropped.add(event);
        }
      }
    }
  }

  const remaining = crowded ? events.filter((event) => !dropped.has(event)) : events;

  if (remaining.length > overall) {
    const kept = new Set([...remaining].sort(byRecency).slice(0, overall));

    return remaining.filter((event) => kept.has(event));
  }

  return remaining;
}
