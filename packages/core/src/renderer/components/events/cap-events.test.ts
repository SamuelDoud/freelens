/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeEvent } from "@freelensapp/kube-object";
import { observable } from "mobx";
import { beforeEach, describe, expect, it } from "vitest";
import directoryForKubeConfigsInjectable from "../../../common/app-paths/directory-for-kube-configs/directory-for-kube-configs.injectable";
import directoryForUserDataInjectable from "../../../common/app-paths/directory-for-user-data/directory-for-user-data.injectable";
import { Cluster } from "../../../common/cluster/cluster";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import { getDiForUnitTesting } from "../../getDiForUnitTesting";
import storesAndApisCanBeCreatedInjectable from "../../stores-apis-can-be-created.injectable";
import { capEvents } from "./cap-events";
import eventStoreInjectable from "./store.injectable";

import type { EventStore } from "./store";

const base = Date.parse("2026-01-01T00:00:00Z");
const iso = (minutes: number) => new Date(base + minutes * 60_000).toISOString();

let counter = 0;

const makeEvent = (
  object: string,
  type: "Normal" | "Warning",
  createdMinute: number,
  lastMinute: number | undefined,
  kind = "Deployment",
) =>
  new KubeEvent({
    apiVersion: "v1",
    kind: "Event",
    metadata: {
      name: `e${counter}`,
      namespace: "ns",
      uid: `event-${counter++}`,
      resourceVersion: "1",
      creationTimestamp: iso(createdMinute),
      selfLink: "/",
    },
    involvedObject: {
      uid: object,
      kind,
      name: object,
      namespace: "ns",
      apiVersion: "v1",
      resourceVersion: "1",
      fieldPath: "",
    },
    type,
    lastTimestamp: lastMinute === undefined ? undefined : iso(lastMinute),
    message: "m",
    reason: "r",
  } as unknown as ConstructorParameters<typeof KubeEvent>[0]);

describe("capEvents", () => {
  it("returns the same array when nothing exceeds the caps", () => {
    const events = [makeEvent("a", "Normal", 1, 1), makeEvent("a", "Warning", 2, 2), makeEvent("b", "Normal", 3, 3)];

    expect(capEvents(events, 5, 10)).toBe(events);
  });

  it("keeps the most recently active events of an object, in the order given", () => {
    // created newest first, like the sorted store; event 0 is old but keeps recurring
    const events = [0, 1, 2, 3, 4, 5].map((i) => makeEvent("a", "Normal", 100 - i, i === 5 ? 500 : 100 - i));
    const other = makeEvent("b", "Normal", 1, 1);
    const capped = capEvents([...events, other], 3, 100);

    expect(capped).toEqual([events[0], events[1], events[5], other]);
  });

  it("keeps the newest Warning of an object whatever its age", () => {
    const warning = makeEvent("a", "Warning", 1, 1);
    const normals = Array.from({ length: 10 }, (_, i) => makeEvent("a", "Normal", 10 + i, 10 + i));
    const capped = capEvents([...normals, warning], 3, 100);

    expect(capped).toContain(warning);
    expect(capped).toHaveLength(4);
  });

  it("keeps the most recently active events overall", () => {
    const events = Array.from({ length: 10 }, (_, i) => makeEvent(`o${i}`, "Normal", i, i));
    const capped = capEvents(events, 5, 4);

    expect(capped).toEqual([events[6], events[7], events[8], events[9]]);
  });
});

describe("EventStore with capped events", () => {
  let store: EventStore;

  beforeEach(() => {
    const di = getDiForUnitTesting();

    di.override(directoryForUserDataInjectable, () => "/some-user-store-path");
    di.override(directoryForKubeConfigsInjectable, () => "/some-kube-configs");
    di.override(storesAndApisCanBeCreatedInjectable, () => true);
    di.override(hostedClusterInjectable, () => new Cluster({ contextName: "c", id: "i", kubeConfigPath: "/p" }));
    store = di.inject(eventStoreInjectable);
  });

  // The consumer picks, written as the components make them.
  const latestWarning = (events: KubeEvent[]) => {
    let latest: KubeEvent | undefined;
    let latestTime = Number.NEGATIVE_INFINITY;

    for (const event of events) {
      if (event.type !== "Warning") continue;

      const time = event.lastTimestamp ? Date.parse(event.lastTimestamp) : event.getCreationTimestamp();

      if (time > latestTime) {
        latestTime = time;
        latest = event;
      }
    }

    return latest;
  };

  it("shows what the uncapped store shows for warnings, per-object details and the newest events", () => {
    let seed = 99;
    const random = (n: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;

      return seed % n;
    };

    for (let round = 0; round < 30; round++) {
      const objects = Array.from({ length: 6 }, (_, i) => `obj${i}`);
      const events = Array.from({ length: 120 }, () => {
        const created = random(1000);
        const last = random(3) === 0 ? undefined : created + random(300);

        return makeEvent(objects[random(objects.length)], random(2) ? "Warning" : "Normal", created, last);
      });
      const perObject = 8;

      // the store orders its events as the timeline, newest created first
      store.items = observable.array(events.sort((a, b) => b.getCreationTimestamp() - a.getCreationTimestamp()));

      const fullWarnings = store.getWarnings();
      const fullBy = new Map(
        objects.map((o) => [o, store.getEventsByObject({ getId: () => o, kind: "Deployment" } as never)]),
      );

      store.items = observable.array(capEvents(store.items.slice(), perObject, 10_000));

      expect(store.getWarnings()).toEqual(fullWarnings);

      for (const object of objects) {
        const full = fullBy.get(object)!;
        const capped = store.getEventsByObject({ getId: () => object, kind: "Deployment" } as never);

        expect(latestWarning(capped)).toBe(latestWarning(full));
        // the details list opens with the same most recently active event
        const recency = (event: KubeEvent) =>
          Math.max(Date.parse(event.lastTimestamp ?? "0") || 0, event.getCreationTimestamp());
        const newest = (list: KubeEvent[]) => Math.max(...list.map(recency), 0);

        expect(newest(capped)).toBe(newest(full));
        expect(capped.length).toBeLessThanOrEqual(perObject + 2);
        expect(capped.every((event) => full.includes(event))).toBe(true);
      }
    }
  });
});
