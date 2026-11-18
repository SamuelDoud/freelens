/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeObject } from "@freelensapp/kube-object";
import { noop } from "@freelensapp/utilities";
import { autorun, runInAction } from "mobx";
import { describe, expect, it } from "vitest";
import { KubeObjectStore } from "../kube-object.store";

import type { KubeApi } from "@freelensapp/kube-api";

// The lookups and the context filter as they were when each state of the items got its own maps and its
// own pass over every item (dev/2.5.0 kube-object.store.ts).
class SnapshotLookups {
  private byId: Map<string, KubeObject> | undefined;
  private byPath: Map<string, KubeObject> | undefined;
  private idCalls = 0;
  private pathCalls = 0;

  constructor(private readonly snapshot: KubeObject[]) {}

  getById(id: string) {
    if (!this.byId) {
      if (this.idCalls++ === 0) {
        return this.snapshot.find((item) => item.getId() === id);
      }

      this.byId = new Map();

      for (const item of this.snapshot) {
        if (!this.byId.has(item.getId())) this.byId.set(item.getId(), item);
      }
    }

    return this.byId.get(id);
  }

  getByPath(path: string) {
    if (!this.byPath) {
      if (this.pathCalls++ === 0) {
        return this.snapshot.find((item) => item.selfLink === path);
      }

      this.byPath = new Map();

      for (const item of this.snapshot) {
        if (!this.byPath.has(item.selfLink)) this.byPath.set(item.selfLink, item);
      }
    }

    return this.byPath.get(path);
  }
}

const oldContextItems = (items: KubeObject[], contextNamespaces: string[]) => {
  const namespaces = new Set(contextNamespaces);

  return items.filter((item) => {
    const itemNamespace = item.getNs();

    return !itemNamespace || namespaces.has(itemNamespace);
  });
};

class LookupStore extends KubeObjectStore<KubeObject> {
  constructor() {
    super(
      {
        context: {
          allNamespaces: [],
          get contextNamespaces() {
            return (this as any).selected;
          },
          selected: [] as string[],
          hasSelectedAll: false,
          isGlobalWatchEnabled: () => true,
          isGlobalListEnabled: () => false,
          isLoadingAll: () => true,
        } as any,
        logger: { debug: noop, error: noop, info: noop, silly: noop, warn: noop },
      },
      { isNamespaced: true } as KubeApi<KubeObject>,
    );
  }

  selectNamespaces(namespaces: string[]) {
    (this as any).dependencies.context.selected = namespaces;
  }
}

const random = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;

  return seed / 2 ** 32;
};

const namespaces = ["x", "y", "z", undefined];

const make = (n: number, version: number, uid = `uid-${n}`, link = `/link/${n}`) =>
  new KubeObject({
    apiVersion: "v1",
    kind: "Foo",
    metadata: {
      name: `name-${n}`,
      resourceVersion: String(version),
      uid,
      namespace: namespaces[n % namespaces.length],
      selfLink: link,
    } as any,
  });

describe("KubeObjectStore lookups and context items, incremental against per-state", () => {
  it("answer as a rebuild for every state of the items would, over random sequences of writes", () => {
    const next = random(2024);

    for (let round = 0; round < 60; round++) {
      const store = new LookupStore();
      const duplicates = round % 4 === 0;
      let counter = 0;
      const fresh = () => {
        counter += 1;

        // Some objects share an id or a path with another, in the rounds that allow it.
        return duplicates && next() < 0.15
          ? make(counter, 1, `uid-${Math.floor(next() * 20)}`, `/link/${Math.floor(next() * 20)}`)
          : make(counter, 1);
      };

      runInAction(() => store.items.replace(Array.from({ length: 25 }, fresh)));

      for (let step = 0; step < 25; step++) {
        runInAction(() => {
          const items = store.items;

          for (let writes = 1 + Math.floor(next() * 4); writes > 0; writes--) {
            const at = Math.floor(next() * (items.length + 1));
            const kind = next();

            if (kind < 0.25 && items.length) {
              items.splice(at % items.length, 1);
            } else if (kind < 0.45) {
              items.splice(at, 0, fresh());
            } else if (kind < 0.7 && items.length) {
              const old = items[at % items.length];

              // A newer version of an object: same id and path.
              items[at % items.length] = make(
                Number(old.getName().slice(5)),
                Number(old.getResourceVersion()) + 1,
                old.getId(),
                old.selfLink,
              );
            } else if (kind < 0.8) {
              items.replace([...items].reverse());
            } else if (kind < 0.9) {
              items.replace(Array.from({ length: Math.floor(next() * 40) }, fresh));
            } else {
              items.push(fresh());
            }
          }
        });

        if (next() < 0.3) {
          store.selectNamespaces(namespaces.filter((ns) => ns && next() < 0.5) as string[]);
        }

        const snapshot = store.items.slice();
        const reference = new SnapshotLookups(snapshot);
        const ids = [...snapshot.map((item) => item.getId()), "missing"];
        const paths = [...snapshot.map((item) => item.selfLink), "/missing"];

        // The first call of each kind scans, the following ones use a map: both are checked.
        for (let call = 0; call < 3; call++) {
          for (const id of ids) {
            expect(store.getById(id)).toBe(reference.getById(id));
          }

          for (const path of paths) {
            expect(store.getByPath(path)).toBe(reference.getByPath(path));
          }
        }

        const expected = oldContextItems(snapshot, (store as any).dependencies.context.selected);
        const actual = store.contextItems;

        expect(actual.length).toBe(expected.length);
        expect(actual.every((item, i) => item === expected[i])).toBe(true);
      }
    }
  });

  it("lets a reader that used a lookup run again when items change, as before", () => {
    const store = new LookupStore();
    const seen: (KubeObject | undefined)[] = [];
    const a = make(1, 1);
    const a2 = make(1, 2);

    // A second call makes the lookups build their map.
    runInAction(() => store.items.replace([a]));
    store.getById(a.getId());
    store.getById(a.getId());

    const dispose = autorun(() => seen.push(store.getById(a.getId())));

    runInAction(() => (store.items[0] = a2));
    runInAction(() => store.items.clear());
    dispose();

    expect(seen).toEqual([a, a2, undefined]);
  });
});
