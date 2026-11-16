/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeObject } from "@freelensapp/kube-object";
import { noop } from "@freelensapp/utilities";
import { describe, expect, it } from "vitest";
import { KubeObjectStore } from "../kube-object.store";

import type { KubeApi } from "@freelensapp/kube-api";

import type { ItemSorting } from "../../item.store";

const logger = { debug: noop, error: noop, info: noop, silly: noop, warn: noop };
const dependencies = {
  context: {
    allNamespaces: [],
    contextNamespaces: [],
    hasSelectedAll: false,
    isGlobalWatchEnabled: () => true,
    isLoadingAll: () => true,
  },
  logger,
};

// The order variants a store can have: by name (the default, with many ties),
// by a number descending with a second key, and one that overrides `sortItems`.
const variants = {
  name: undefined,
  numberDescending: {
    by: [(item: KubeObject) => Number(item.metadata.labels?.rank), (item: KubeObject) => item.getName()],
    order: "desc",
  } as ItemSorting<KubeObject>,
  custom: "custom",
} as const;

class TestStore extends KubeObjectStore<KubeObject> {
  constructor(variant: keyof typeof variants) {
    super(dependencies, { objectConstructor: KubeObject } as unknown as KubeApi<KubeObject>);
    const sorting = variants[variant];

    if (sorting && sorting !== "custom") {
      (this as unknown as { sorting: ItemSorting<KubeObject> }).sorting = sorting;
    }
  }

  async loadItems() {
    return [];
  }

  flushNew(events: Parameters<TestStore["eventsBuffer"]["push"]>) {
    this.eventsBuffer.push(...events);
    this.updateFromEventsBuffer();
  }

  // The flush as it was before it worked by id.
  flushOld(events: Parameters<TestStore["eventsBuffer"]["push"]>) {
    this.eventsBuffer.clear();
    this["updateFromEventsByRebuilding"](events);
  }

  mergeFull(items: KubeObject[], merge: boolean, namespaces: string[]) {
    this["publishedLoad"] = undefined;

    return this["mergeLoadedItems"](items, merge, namespaces);
  }

  mergeIncremental(items: KubeObject[], merge: boolean, namespaces: string[]) {
    return this["mergeLoadedItems"](items, merge, namespaces);
  }
}

// A store that overrides `sortItems`, as a subclass of a store can.
class CustomSortStore extends TestStore {
  constructor() {
    super("name");
  }

  protected override sortItems(
    items: KubeObject[] = this.items,
    by?: ((item: KubeObject) => unknown)[],
    order?: "asc" | "desc",
  ) {
    return super.sortItems(
      items,
      by ?? [(item: KubeObject) => item.metadata.labels?.rank, (item: KubeObject) => item.getName()],
      order,
    );
  }
}

const createStore = (variant: keyof typeof variants): TestStore =>
  variant === "custom" ? new CustomSortStore() : new TestStore(variant);

const random = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;

  return seed / 4294967296;
};

const data = (uid: string, rv: number, name: string, rank: number, namespace = "ns") => ({
  apiVersion: "v1",
  kind: "Test",
  metadata: {
    uid,
    name,
    namespace,
    resourceVersion: String(rv),
    selfLink: `/test/${uid}`,
    labels: { rank: String(rank) },
  },
});

const describeItems = (store: TestStore) =>
  store.items.map((item) => `${item.getId()}@${item.getResourceVersion()}/${item.getName()}`);

describe.each(Object.keys(variants) as (keyof typeof variants)[])(
  "flush by id equals the rebuilt flush, order: %s",
  (variant) => {
    it("gives the same items in the same order after every flush of random events", () => {
      for (let seed = 1; seed <= 40; seed++) {
        const next = random(seed * 7919);
        const names = ["a", "b", "c", "d", "e", "f"];
        const uids = Array.from({ length: 30 }, (_, index) => `u${index}`);
        const versions = new Map<string, number>();
        const oldStore = createStore(variant);
        const newStore = createStore(variant);
        const initial = (store: TestStore) =>
          store.items.replace(
            (store as unknown as { sortItems: (items: KubeObject[]) => KubeObject[] }).sortItems(
              uids
                .filter(() => next() < 0.7)
                .map((uid) => {
                  versions.set(uid, 1);

                  return new KubeObject(
                    data(uid, 1, names[Math.floor(next() * names.length)], Math.floor(next() * 4)) as never,
                  );
                }),
            ),
          );

        initial(oldStore);
        // The same objects, so that unchanged items can be compared by identity.
        newStore.items.replace(oldStore.items.slice());

        for (let round = 0; round < 25; round++) {
          const events = Array.from({ length: Math.floor(next() * 12) }, () => {
            const uid = uids[Math.floor(next() * uids.length)];
            const roll = next();
            // Versions rise, except for the replays and out-of-order ones.
            const version = roll < 0.15 ? (versions.get(uid) ?? 1) : roll < 0.25 ? 1 : (versions.get(uid) ?? 1) + 1;

            if (roll >= 0.25) versions.set(uid, version);

            const type = next() < 0.2 ? "DELETED" : next() < 0.5 ? "ADDED" : "MODIFIED";
            // A third of the changes move the object in the order.
            const name = next() < 0.33 ? names[Math.floor(next() * names.length)] : names[uid.length % names.length];
            const rank = next() < 0.33 ? Math.floor(next() * 4) : 0;

            return { type, object: data(uid, version, name, rank) } as never;
          });

          if (round % 7 === 6) {
            // A relist after a 410, a load, or any other write to the items.
            const relisted = uids
              .filter(() => next() < 0.5)
              .map(
                (uid) =>
                  new KubeObject(
                    data(uid, 50 + round, names[Math.floor(next() * names.length)], Math.floor(next() * 4)) as never,
                  ),
              );

            oldStore.items.replace(relisted);
            newStore.items.replace(relisted);
          }

          const before = newStore.items.slice();

          oldStore.flushOld(events);
          newStore.flushNew(events);

          expect(describeItems(newStore)).toEqual(describeItems(oldStore));

          // An item no event touched is the object it was.
          const touched = new Set(
            events.map((event: { object: { metadata: { uid: string } } }) => event.object.metadata.uid),
          );

          for (const item of newStore.items) {
            if (!touched.has(item.getId())) {
              expect(before).toContain(item);
            }
          }
        }
      }
    });

    it("leaves an unsorted list as the rebuilt flush does when no event moves anything", () => {
      const oldStore = createStore(variant);
      const newStore = createStore(variant);
      const unsorted = ["c", "a", "b"].map((name) => new KubeObject(data(`u-${name}`, 1, name, 0) as never));

      oldStore.items.replace(unsorted);
      newStore.items.replace(unsorted);

      const events = [{ type: "MODIFIED", object: data("u-a", 2, "a", 0) }] as never;

      oldStore.flushOld(events);
      newStore.flushNew(events);

      expect(describeItems(newStore)).toEqual(describeItems(oldStore));
    });

    it("sorts an unsorted list like the rebuilt flush when an event adds an item", () => {
      const oldStore = createStore(variant);
      const newStore = createStore(variant);
      const unsorted = ["c", "a", "b"].map((name) => new KubeObject(data(`u-${name}`, 1, name, 0) as never));

      oldStore.items.replace(unsorted);
      newStore.items.replace(unsorted);

      const events = [{ type: "ADDED", object: data("u-z", 1, "b", 0) }] as never;

      oldStore.flushOld(events);
      newStore.flushNew(events);

      expect(describeItems(newStore)).toEqual(describeItems(oldStore));
    });
  },
);

describe("the merge of a load that goes on equals the merge of everything", () => {
  it.each([true, false])("with merge %s, for pages of random items across namespaces", (merge) => {
    for (let seed = 1; seed <= 30; seed++) {
      const next = random(seed * 104729);
      const names = ["a", "b", "c", "d"];
      const namespaces = ["n1", "n2", "n3"];
      const full = new TestStore("name");
      const incremental = new TestStore("name");
      // Items of a namespace this load does not cover stay in both.
      const others = ["o1", "o2", "o3"].map(
        (uid) => new KubeObject(data(uid, 1, names[Math.floor(next() * 4)], 0, "other") as never),
      );

      full.items.replace(others);
      incremental.items.replace(others);

      let uid = 0;
      let accumulated: KubeObject[] = [];

      for (let page = 0; page < 12; page++) {
        const items = Array.from(
          { length: Math.floor(next() * 15) },
          () =>
            new KubeObject(
              data(`p${uid++}`, 1, names[Math.floor(next() * 4)], 0, namespaces[Math.floor(next() * 3)]) as never,
            ),
        );

        accumulated = [...accumulated, ...items];

        const snapshot = [...accumulated];

        full.mergeFull(snapshot, merge, namespaces);
        incremental.mergeIncremental(snapshot, merge, namespaces);

        expect(describeItems(incremental)).toEqual(describeItems(full));
      }

      // The completed load lists the same items in another order, and that
      // order decides which of equal items comes first.
      const final = [...accumulated].reverse();

      full.mergeFull(final, merge, namespaces);
      incremental.mergeIncremental(final, merge, namespaces);

      expect(describeItems(incremental)).toEqual(describeItems(full));
    }
  });

  it("falls back to merging everything after something else wrote to the items", () => {
    const full = new TestStore("name");
    const incremental = new TestStore("name");
    const first = ["b", "a"].map((name) => new KubeObject(data(`first-${name}`, 1, name, 0, "n1") as never));
    const second = [...first, new KubeObject(data("second", 1, "a", 0, "n1") as never)];
    const stranger = new KubeObject(data("stranger", 1, "0", 0, "n1") as never);

    full.mergeFull(first, true, ["n1"]);
    incremental.mergeIncremental(first, true, ["n1"]);
    full.items.push(stranger);
    incremental.items.push(stranger);
    full.mergeFull(second, true, ["n1"]);
    incremental.mergeIncremental(second, true, ["n1"]);

    expect(describeItems(incremental)).toEqual(describeItems(full));
    // The stranger was in a namespace the load covers, so it is gone.
    expect(describeItems(incremental).some((entry) => entry.startsWith("stranger"))).toBe(false);
  });
});
