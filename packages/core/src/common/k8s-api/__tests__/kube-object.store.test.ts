/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeObject, KubeStatus } from "@freelensapp/kube-object";
import { noop, WrappedAbortController } from "@freelensapp/utilities";
import { observe } from "mobx";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KubeObjectStore, slowLoadMs } from "../kube-object.store";

import type { FetchRequestInit as RequestInit } from "@freelensapp/json-api";
import type { KubeApi, KubeApiWatchOptions } from "@freelensapp/kube-api";
import type { KubeJsonApiDataFor } from "@freelensapp/kube-object";

import type { KubeObjectStoreLoadingParams, KubeObjectStoreOptions } from "../kube-object.store";

class FakeKubeObjectStore extends KubeObjectStore<KubeObject> {
  constructor(
    private readonly _loadItems: (params: KubeObjectStoreLoadingParams) => KubeObject[],
    api: Partial<KubeApi<KubeObject>>,
    opts?: KubeObjectStoreOptions,
  ) {
    super(
      {
        context: {
          allNamespaces: [],
          contextNamespaces: [],
          hasSelectedAll: false,
          isGlobalWatchEnabled: () => true,
          isLoadingAll: () => true,
        },
        logger: {
          debug: noop,
          error: noop,
          info: noop,
          silly: noop,
          warn: noop,
        },
      },
      api as KubeApi<KubeObject>,
      opts,
    );
  }

  async loadItems(params: KubeObjectStoreLoadingParams) {
    return Promise.resolve(this._loadItems(params));
  }
}

// Unlike FakeKubeObjectStore above, this exercises the real `loadItems()` --
// the method that owns the `onLoadFailure` branches -- against a fake
// `api.list()`, instead of bypassing it entirely.
class RealLoadItemsKubeObjectStore extends KubeObjectStore<KubeObject> {
  constructor(api: Partial<KubeApi<KubeObject>>, isLoadingAll: (namespaces: string[]) => boolean = () => true) {
    super(
      {
        context: {
          allNamespaces: [],
          contextNamespaces: [],
          hasSelectedAll: false,
          isGlobalWatchEnabled: () => true,
          isLoadingAll,
        },
        logger: {
          debug: noop,
          error: noop,
          info: noop,
          silly: noop,
          warn: noop,
        },
      },
      api as KubeApi<KubeObject>,
    );
  }
}

describe("KubeObjectStore", () => {
  it("should remove an object from the list of items after it is not returned from listing the same namespace again", async () => {
    const loadItems = vi.fn();
    const obj = new KubeObject({
      apiVersion: "v1",
      kind: "Foo",
      metadata: {
        name: "some-obj-name",
        resourceVersion: "1",
        uid: "some-uid",
        namespace: "default",
        selfLink: "/some/self/link",
      },
    });
    const store = new FakeKubeObjectStore(loadItems, {
      isNamespaced: true,
    });

    loadItems.mockImplementationOnce(() => [obj]);

    await store.loadAll({
      namespaces: ["default"],
    });

    expect(store.items).toContain(obj);

    loadItems.mockImplementationOnce(() => []);

    await store.loadAll({
      namespaces: ["default"],
    });

    expect(store.items).not.toContain(obj);
  });

  it("should not remove an object that is not returned, if it is in a different namespace", async () => {
    const loadItems = vi.fn();
    const objInDefaultNamespace = new KubeObject({
      apiVersion: "v1",
      kind: "Foo",
      metadata: {
        name: "some-obj-name",
        resourceVersion: "1",
        uid: "some-uid",
        namespace: "default",
        selfLink: "/some/self/link",
      },
    });
    const objNotInDefaultNamespace = new KubeObject({
      apiVersion: "v1",
      kind: "Foo",
      metadata: {
        name: "some-obj-name",
        resourceVersion: "1",
        uid: "some-uid",
        namespace: "not-default",
        selfLink: "/some/self/link",
      },
    });
    const store = new FakeKubeObjectStore(loadItems, {
      isNamespaced: true,
    });

    loadItems.mockImplementationOnce(() => [objInDefaultNamespace]);

    await store.loadAll({
      namespaces: ["default"],
    });

    expect(store.items).toContain(objInDefaultNamespace);

    loadItems.mockImplementationOnce(() => [objNotInDefaultNamespace]);

    await store.loadAll({
      namespaces: ["not-default"],
    });

    expect(store.items).toContain(objInDefaultNamespace);
  });

  it("should remove all objects not returned if the api is cluster-scoped", async () => {
    const loadItems = vi.fn();
    const clusterScopedObject1 = new KubeObject({
      apiVersion: "v1",
      kind: "Foo",
      metadata: {
        name: "some-obj-name",
        resourceVersion: "1",
        uid: "some-uid",
        selfLink: "/some/self/link",
      },
    });
    const clusterScopedObject2 = new KubeObject({
      apiVersion: "v1",
      kind: "Foo",
      metadata: {
        name: "some-obj-name",
        resourceVersion: "1",
        uid: "some-uid",
        namespace: "not-default",
        selfLink: "/some/self/link",
      },
    });
    const store = new FakeKubeObjectStore(loadItems, {
      isNamespaced: false,
    });

    loadItems.mockImplementationOnce(() => [clusterScopedObject1]);

    await store.loadAll({});

    expect(store.items).toContain(clusterScopedObject1);

    loadItems.mockImplementationOnce(() => [clusterScopedObject2]);

    await store.loadAll({});

    expect(store.items).not.toContain(clusterScopedObject1);
  });

  it("should not treat an aborted load as a failed load", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(noop);
    const loadItems = vi.fn();
    const obj = new KubeObject({
      apiVersion: "v1",
      kind: "Foo",
      metadata: {
        name: "some-obj-name",
        resourceVersion: "1",
        uid: "some-uid",
        selfLink: "/some/self/link",
      },
    });
    const store = new FakeKubeObjectStore(loadItems, {
      isNamespaced: false,
    });

    loadItems.mockImplementationOnce(() => [obj]);

    await store.loadAll({});

    expect(store.items).toContain(obj);

    loadItems.mockImplementationOnce(() => {
      throw new DOMException("The operation was aborted.", "AbortError");
    });

    const result = await store.loadAll({});

    expect(result).toBeUndefined();
    // the freshly loaded items and the loading flags must be left untouched
    expect(store.items).toContain(obj);
    expect(store.failedLoading).toBe(false);
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("should not treat a load with an already-aborted signal as a failed load", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(noop);
    const loadItems = vi.fn();
    const obj = new KubeObject({
      apiVersion: "v1",
      kind: "Foo",
      metadata: {
        name: "some-obj-name",
        resourceVersion: "1",
        uid: "some-uid",
        selfLink: "/some/self/link",
      },
    });
    const store = new FakeKubeObjectStore(loadItems, {
      isNamespaced: false,
    });

    loadItems.mockImplementationOnce(() => [obj]);

    await store.loadAll({});

    expect(store.items).toContain(obj);

    const controller = new AbortController();

    controller.abort();

    loadItems.mockImplementationOnce(() => {
      throw new Error("boom");
    });

    const result = await store.loadAll({
      reqInit: { signal: controller.signal } as RequestInit,
    });

    expect(result).toBeUndefined();
    expect(store.items).toContain(obj);
    expect(store.failedLoading).toBe(false);
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("should treat a genuine load failure as a failed load", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(noop);
    const loadItems = vi.fn();
    const obj = new KubeObject({
      apiVersion: "v1",
      kind: "Foo",
      metadata: {
        name: "some-obj-name",
        resourceVersion: "1",
        uid: "some-uid",
        selfLink: "/some/self/link",
      },
    });
    const store = new FakeKubeObjectStore(loadItems, {
      isNamespaced: false,
    });

    loadItems.mockImplementationOnce(() => [obj]);

    await store.loadAll({});

    expect(store.items).toContain(obj);

    loadItems.mockImplementationOnce(() => {
      throw new Error("boom");
    });

    const result = await store.loadAll({});

    expect(result).toBeUndefined();
    // a real failure still resets the store and flags the failure
    expect(store.items).not.toContain(obj);
    expect(store.failedLoading).toBe(true);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("does not report an aborted cluster-scoped/all-namespaces load through onLoadFailure", async () => {
    const onLoadFailure = vi.fn();
    const obj = new KubeObject({
      apiVersion: "v1",
      kind: "Foo",
      metadata: {
        name: "some-obj-name",
        resourceVersion: "1",
        uid: "some-uid",
        selfLink: "/some/self/link",
      },
    });
    const list = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("signal is aborted without reason", "AbortError"))
      .mockResolvedValueOnce([obj]);
    const store = new RealLoadItemsKubeObjectStore({ isNamespaced: false, list });

    const result = await store.loadAll({ onLoadFailure });

    expect(result).toBeUndefined();
    expect(onLoadFailure).not.toHaveBeenCalled();
    expect(store.failedLoading).toBe(false);
    // the store must not believe it is loaded: the next load (e.g. the view
    // mounting again) has to populate it
    expect(store.isLoaded).toBe(false);

    await store.loadAll({ onLoadFailure });

    expect(store.items).toContain(obj);
    expect(store.isLoaded).toBe(true);
    expect(onLoadFailure).not.toHaveBeenCalled();
  });

  it("keeps the loaded items and the loaded state when a cluster-scoped/all-namespaces reload is aborted", async () => {
    const onLoadFailure = vi.fn();
    const first = new KubeObject({
      apiVersion: "v1",
      kind: "Foo",
      metadata: {
        name: "first",
        resourceVersion: "1",
        uid: "uid-first",
        selfLink: "/some/self/link/first",
      },
    });
    const second = new KubeObject({
      apiVersion: "v1",
      kind: "Foo",
      metadata: {
        name: "second",
        resourceVersion: "2",
        uid: "uid-second",
        selfLink: "/some/self/link/second",
      },
    });
    const list = vi
      .fn()
      .mockResolvedValueOnce([first])
      .mockRejectedValueOnce(new DOMException("signal is aborted without reason", "AbortError"))
      .mockResolvedValueOnce([second]);
    const store = new RealLoadItemsKubeObjectStore({ isNamespaced: false, list });

    await store.loadAll({ onLoadFailure });

    expect(store.items).toContain(first);
    expect(store.isLoaded).toBe(true);

    const result = await store.loadAll({ onLoadFailure });

    expect(result).toBeUndefined();
    expect(onLoadFailure).not.toHaveBeenCalled();
    // the aborted reload leaves everything as it was
    expect(store.items).toContain(first);
    expect(store.items).toHaveLength(1);
    expect(store.isLoaded).toBe(true);
    expect(store.failedLoading).toBe(false);

    await store.loadAll({ onLoadFailure });

    expect(store.items).toContain(second);
    expect(store.items).toHaveLength(1);
    expect(onLoadFailure).not.toHaveBeenCalled();
  });

  it("treats a cluster-scoped/all-namespaces failure on an already-aborted signal as an abort", async () => {
    const onLoadFailure = vi.fn();
    const obj = new KubeObject({
      apiVersion: "v1",
      kind: "Foo",
      metadata: {
        name: "some-obj-name",
        resourceVersion: "1",
        uid: "some-uid",
        selfLink: "/some/self/link",
      },
    });
    const list = vi.fn().mockResolvedValueOnce([obj]).mockRejectedValueOnce(new Error("boom"));
    const store = new RealLoadItemsKubeObjectStore({ isNamespaced: false, list });

    await store.loadAll({ onLoadFailure });

    const controller = new AbortController();

    controller.abort();

    const result = await store.loadAll({ reqInit: { signal: controller.signal } as RequestInit, onLoadFailure });

    expect(result).toBeUndefined();
    expect(onLoadFailure).not.toHaveBeenCalled();
    expect(store.items).toContain(obj);
    expect(store.isLoaded).toBe(true);
    expect(store.failedLoading).toBe(false);
  });

  it("still reports a genuine cluster-scoped/all-namespaces load failure through onLoadFailure", async () => {
    const onLoadFailure = vi.fn();
    const list = vi.fn().mockRejectedValueOnce(new Error("boom"));
    const store = new RealLoadItemsKubeObjectStore({ isNamespaced: false, list });

    await store.loadAll({ onLoadFailure });

    expect(onLoadFailure).toHaveBeenCalledTimes(1);
    expect(onLoadFailure.mock.calls[0][0].message).toContain("Failed to load");
  });

  it("does not report an aborted namespaced load through onLoadFailure", async () => {
    const onLoadFailure = vi.fn();
    const list = vi.fn().mockRejectedValueOnce(new DOMException("The operation was aborted.", "AbortError"));
    const store = new RealLoadItemsKubeObjectStore({ isNamespaced: true, list }, () => false);

    const result = await store.loadAll({ namespaces: ["some-namespace"], onLoadFailure });

    expect(result).toBeUndefined();
    expect(onLoadFailure).not.toHaveBeenCalled();
    expect(store.failedLoading).toBe(false);
  });

  it("treats a namespaced failure on an already-aborted signal as an abort", async () => {
    const onLoadFailure = vi.fn();
    const list = vi.fn().mockRejectedValueOnce(new Error("boom"));
    const store = new RealLoadItemsKubeObjectStore({ isNamespaced: true, list }, () => false);
    const controller = new AbortController();

    controller.abort();

    const result = await store.loadAll({
      namespaces: ["some-namespace"],
      reqInit: { signal: controller.signal } as RequestInit,
      onLoadFailure,
    });

    expect(result).toBeUndefined();
    expect(onLoadFailure).not.toHaveBeenCalled();
    expect(store.failedLoading).toBe(false);
  });

  it("still reports a genuine namespaced load failure through onLoadFailure", async () => {
    const onLoadFailure = vi.fn();
    const list = vi.fn().mockRejectedValueOnce(new Error("boom"));
    const store = new RealLoadItemsKubeObjectStore({ isNamespaced: true, list }, () => false);

    await store.loadAll({ namespaces: ["some-namespace"], onLoadFailure });

    expect(onLoadFailure).toHaveBeenCalledTimes(1);
    expect(onLoadFailure.mock.calls[0][0].message).toContain("Failed to load");
  });

  describe("paginated loading", () => {
    const objectNamed = (name: string, namespace = "default") =>
      new KubeObject({
        apiVersion: "v1",
        kind: "Foo",
        metadata: {
          name,
          resourceVersion: "1",
          uid: `uid-${namespace}-${name}`,
          namespace,
          selfLink: `/some/self/link/${namespace}/${name}`,
        },
      });

    const deferred = <T>() => {
      let resolve!: (value: T) => void;
      let reject!: (error: unknown) => void;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });

      return { promise, resolve, reject };
    };

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.clearAllTimers();
      vi.useRealTimers();
    });

    it("publishes pages as they arrive and reports progress until the load completes", async () => {
      const [a, b, c] = [objectNamed("a"), objectNamed("b"), objectNamed("c")];
      const gate = deferred<KubeObject[]>();
      const list = vi.fn(({ onPage }: { onPage?: (page: unknown) => void }) => {
        onPage?.({ items: [a], loaded: 1, remainingItemCount: 2 });
        onPage?.({ items: [b], loaded: 2, remainingItemCount: 1 });

        return gate.promise;
      });
      const store = new RealLoadItemsKubeObjectStore({ isNamespaced: true, list });

      const loading = store.loadAll({});
      await vi.advanceTimersByTimeAsync(1000);

      expect(list.mock.calls[0][0]).toMatchObject({ pageSize: 500 });
      expect(store.items.map((item) => item.getName())).toEqual(["a", "b"]);
      expect(store.loadingProgress).toEqual({ loaded: 2, total: 3 });
      expect(store.isLoaded).toBe(false);

      gate.resolve([a, b, c]);
      await loading;

      expect(store.items.map((item) => item.getName())).toEqual(["a", "b", "c"]);
      expect(store.loadingProgress).toBeUndefined();
      expect(store.isLoaded).toBe(true);
    });

    it("shows no object twice when a list starts over after its continue token expired", async () => {
      const [a, b, c] = [objectNamed("a"), objectNamed("b"), objectNamed("c")];
      const gate = deferred<KubeObject[]>();
      const list = vi.fn(({ onPage }: { onPage?: (page: unknown) => void }) => {
        onPage?.({ items: [a, b], loaded: 2, remainingItemCount: 1 });
        // the token expired: the list begins again from its first page
        onPage?.({ items: [a, b], loaded: 2, remainingItemCount: 1 });

        return gate.promise;
      });
      const store = new RealLoadItemsKubeObjectStore({ isNamespaced: true, list });

      const loading = store.loadAll({});
      await vi.advanceTimersByTimeAsync(1000);

      expect(store.items.map((item) => item.getName())).toEqual(["a", "b"]);
      expect(store.loadingProgress).toEqual({ loaded: 2, total: 3 });

      gate.resolve([a, b, c]);
      await loading;
    });

    it("streams every requested namespace and keeps items of namespaces not being loaded", async () => {
      const keep = objectNamed("keep", "other");
      const a1 = objectNamed("a1", "ns1");
      const a2 = objectNamed("a2", "ns1");
      const b1 = objectNamed("b1", "ns2");
      const gates = { ns1: deferred<KubeObject[]>(), ns2: deferred<KubeObject[]>() };
      const list = vi.fn(({ namespace, onPage }: { namespace?: string; onPage?: (page: unknown) => void }) => {
        if (namespace === "ns1") {
          onPage?.({ items: [a1], loaded: 1, remainingItemCount: 1 });

          return gates.ns1.promise;
        }

        onPage?.({ items: [b1], loaded: 1, remainingItemCount: 0, done: true });

        return gates.ns2.promise;
      });
      const store = new RealLoadItemsKubeObjectStore({ isNamespaced: true, list }, () => false);

      store.items.replace([keep]);

      const loading = store.loadAll({ namespaces: ["ns1", "ns2"] });
      await vi.advanceTimersByTimeAsync(1000);

      expect(store.items.map((item) => item.getName()).sort()).toEqual(["a1", "b1", "keep"]);
      expect(store.loadingProgress).toEqual({
        loaded: 2,
        total: 3,
        namespaces: { done: 1, total: 2, waitingOn: [] },
      });

      gates.ns1.resolve([a1, a2]);
      gates.ns2.resolve([b1]);
      await loading;

      expect(store.items.map((item) => item.getName()).sort()).toEqual(["a1", "a2", "b1", "keep"]);
      expect(store.loadingProgress).toBeUndefined();
    });

    it("does not publish a pending page after the store was reset, and clears progress on abort", async () => {
      const [a, b] = [objectNamed("a"), objectNamed("b")];
      const gate = deferred<KubeObject[]>();
      const list = vi.fn(({ onPage }: { onPage?: (page: unknown) => void }) => {
        onPage?.({ items: [a], loaded: 1, remainingItemCount: 1 });
        onPage?.({ items: [b], loaded: 2, remainingItemCount: 0 });

        return gate.promise;
      });
      const store = new RealLoadItemsKubeObjectStore({ isNamespaced: true, list });

      const loading = store.loadAll({});
      await vi.advanceTimersByTimeAsync(0);

      expect(store.items.map((item) => item.getName())).toEqual(["a"]);

      store.reset();
      await vi.advanceTimersByTimeAsync(1000);

      expect(store.items).toHaveLength(0);

      gate.reject(new DOMException("The operation was aborted.", "AbortError"));

      await expect(loading).resolves.toBeUndefined();
      expect(store.items).toHaveLength(0);
      expect(store.loadingProgress).toBeUndefined();
      expect(store.failedLoading).toBe(false);
    });

    it("without an early watch, loads all namespaces through per-namespace streams and watches from the oldest snapshot", async () => {
      const resourceVersions = new Map<string, string>();
      const a1 = objectNamed("a1", "ns1");
      const b1 = objectNamed("b1", "ns2");
      const list = vi.fn(({ namespace, onPage }: { namespace?: string; onPage?: (page: unknown) => void }) => {
        if (namespace === "ns1") {
          onPage?.({ items: [a1], loaded: 1, remainingItemCount: 0, resourceVersion: "30" });

          return Promise.resolve([a1]);
        }

        onPage?.({ items: [b1], loaded: 1, remainingItemCount: 0, resourceVersion: "20" });

        return Promise.resolve([b1]);
      });
      const store = new RealLoadItemsKubeObjectStore({
        isNamespaced: true,
        list,
        setResourceVersion: (namespace: string, version: string) => resourceVersions.set(namespace, version),
        getResourceVersion: (namespace = "") => resourceVersions.get(namespace),
      } as Partial<KubeApi<KubeObject>>);

      await store.loadAll({ namespaces: ["ns1", "ns2"] });

      // One paginated stream per namespace instead of one cluster-wide list.
      expect(
        list.mock.calls
          .filter(([options]) => options.onPage)
          .map(([options]) => options.namespace)
          .sort(),
      ).toEqual(["ns1", "ns2"]);
      expect(store.items.map((item) => item.getName()).sort()).toEqual(["a1", "b1"]);
      // The single cluster-wide watch must start from the oldest namespace
      // snapshot: anything newer could skip events of the lagging namespace.
      expect(resourceVersions.get("")).toBe("20");
      // Empty loadedNamespaces keeps subscribe() on the cluster-wide watch.
      expect(store["loadedNamespaces"].get()).toEqual([]);
    });

    it("keeps at most 16 namespace streams in flight at once", async () => {
      const namespaces = Array.from({ length: 20 }, (_, index) => `ns-${index}`);
      const gates = new Map(namespaces.map((namespace) => [namespace, deferred<KubeObject[]>()]));
      let inFlight = 0;
      let maxInFlight = 0;
      const list = vi.fn(async ({ namespace }: { namespace?: string }) => {
        if (namespace === undefined) {
          return [];
        }

        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);

        try {
          return await gates.get(namespace ?? "")!.promise;
        } finally {
          inFlight--;
        }
      });
      const store = new RealLoadItemsKubeObjectStore({
        isNamespaced: true,
        list,
        setResourceVersion: () => {},
        getResourceVersion: () => undefined,
      } as Partial<KubeApi<KubeObject>>);

      const namespaceLists = () => list.mock.calls.filter(([options]) => options.namespace !== undefined).length;
      const loading = store.loadAll({ namespaces });
      await vi.advanceTimersByTimeAsync(0);

      expect(namespaceLists()).toBe(16);
      expect(maxInFlight).toBe(16);

      for (const gate of gates.values()) {
        gate.resolve([]);
      }

      await loading;

      expect(namespaceLists()).toBe(20);
      expect(maxInFlight).toBeLessThanOrEqual(16);
    });

    describe("watching all namespaces from before they are listed", () => {
      const json = (name: string, namespace: string, resourceVersion: string, status?: object) => ({
        apiVersion: "v1",
        kind: "Foo",
        metadata: {
          name,
          namespace,
          resourceVersion,
          uid: `uid-${namespace}-${name}`,
          selfLink: `/some/self/link/${namespace}/${name}`,
        },
        ...(status ? { status } : {}),
      });

      const setup = ({ failWatch = false } = {}) => {
        const versions = new Map<string, string>();
        const a1 = objectNamed("a1", "ns1");
        const b1 = objectNamed("b1", "ns2");
        let watchOptions: any;
        const emit = (event: unknown) => watchOptions?.callback(event, null);
        const list = vi.fn(
          (options: { namespace?: string; onPage?: (page: unknown) => void }, query?: { limit?: number }) => {
            if (query?.limit === 1) {
              versions.set("", "100");

              return Promise.resolve([]);
            }

            if (options.namespace === "ns1") {
              // Older than ns1's snapshot: already in its list.
              emit({ type: "MODIFIED", object: json("a1", "ns1", "105", { phase: "stale" }) });
              options.onPage?.({ items: [a1], loaded: 1, resourceVersion: "110", done: true });

              return Promise.resolve([a1]);
            }

            options.onPage?.({ items: [b1], loaded: 1, resourceVersion: "115", done: true });
            // Newer than ns2's snapshot, and a namespace created meanwhile.
            emit({ type: "MODIFIED", object: json("b1", "ns2", "120", { phase: "new" }) });
            emit({ type: "ADDED", object: json("c1", "ns3", "125") });
            watchOptions?.onBookmark("130");

            return Promise.resolve([b1]);
          },
        );
        const watch = vi.fn((options: any) => {
          watchOptions = options;

          if (failWatch) {
            options.callback(null, new Response(null, { status: 500 }));
          }

          return noop;
        });
        const store = new RealLoadItemsKubeObjectStore({
          isNamespaced: true,
          list,
          watch,
          objectConstructor: KubeObject,
          setResourceVersion: (namespace: string, version: string) => versions.set(namespace, version),
          getResourceVersion: (namespace = "") => versions.get(namespace),
        } as Partial<KubeApi<KubeObject>>);

        return { store, versions, watch, getWatchOptions: () => watchOptions };
      };

      it("applies what changed after each namespace's snapshot and hands the watch on from there", async () => {
        const { store, versions, watch, getWatchOptions } = setup();

        await store.loadAll({ namespaces: ["ns1", "ns2"] });

        expect(watch).toHaveBeenCalledTimes(1);
        expect(getWatchOptions()).toMatchObject({ namespace: "", timeout: 0, query: { resourceVersion: "100" } });
        expect(getWatchOptions().abortController.signal.aborted).toBe(true);
        expect(store.items.map((item) => item.getName()).sort()).toEqual(["a1", "b1", "c1"]);
        expect(store.items.find((item) => item.getName() === "a1")?.status).toBeUndefined();
        expect(store.items.find((item) => item.getName() === "b1")?.status).toEqual({ phase: "new" });
        expect(versions.get("")).toBe("130");
      });

      it("falls back to the oldest snapshot when the early watch fails", async () => {
        const { store, versions } = setup({ failWatch: true });

        await store.loadAll({ namespaces: ["ns1", "ns2"] });

        expect(store.items.map((item) => item.getName()).sort()).toEqual(["a1", "b1"]);
        expect(versions.get("")).toBe("110");
      });
    });

    it("loads a namespace holding more objects than a call can take as arguments", async () => {
      // Spreading a list into push() throws a RangeError from about 120k
      // arguments on in Node, and from some hundred thousand under Vitest,
      // whose stack is larger; one shared item keeps the list cheap to build.
      const count = 1_000_000;
      const shared = {
        getNs: () => "big",
        getName: () => "item",
        getId: () => "uid",
      } as unknown as KubeObject;
      const big = new Array<KubeObject>(count).fill(shared);
      const small = objectNamed("small", "tiny");
      const list = vi.fn(({ namespace }: { namespace?: string }) =>
        Promise.resolve(namespace === "big" ? big : [small]),
      );
      const store = new RealLoadItemsKubeObjectStore({ isNamespaced: true, list }, () => false);

      await expect(store.loadAll({ namespaces: ["big", "tiny"] })).resolves.toHaveLength(count + 1);

      expect(store.items).toHaveLength(count + 1);
      expect(store.isLoaded).toBe(true);
    });

    it("names the namespaces a slow load still waits on once only a few are left", async () => {
      const namespaces = ["ns1", "ns2", "ns3", "ns4", "ns5"];
      const gates = new Map(namespaces.map((namespace) => [namespace, deferred<KubeObject[]>()]));
      const list = vi.fn(({ namespace, onPage }: { namespace?: string; onPage?: (page: unknown) => void }) => {
        if (namespace === undefined) {
          return Promise.resolve([]);
        }

        if (namespace === "ns1" || namespace === "ns2") {
          onPage?.({ items: [objectNamed("a", namespace)], loaded: 1, done: true });

          return Promise.resolve([objectNamed("a", namespace)]);
        }

        return gates.get(namespace)!.promise;
      });
      const store = new RealLoadItemsKubeObjectStore({ isNamespaced: true, list }, () => false);
      const loading = store.loadAll({ namespaces });

      await vi.advanceTimersByTimeAsync(1000);
      expect(store.loadingProgress?.namespaces).toEqual({ done: 2, total: 5, waitingOn: [] });

      await vi.advanceTimersByTimeAsync(slowLoadMs);
      expect(store.loadingProgress?.namespaces).toEqual({ done: 2, total: 5, waitingOn: ["ns3", "ns4", "ns5"] });

      for (const gate of gates.values()) {
        gate.resolve([]);
      }

      await loading;
      expect(store.loadingProgress).toBeUndefined();
    });

    it("keeps a single cluster-wide stream when only one namespace is loaded", async () => {
      const list = vi.fn(async (_options: { namespace?: string }) => [objectNamed("a", "only")]);
      const store = new RealLoadItemsKubeObjectStore({ isNamespaced: true, list });

      await store.loadAll({ namespaces: ["only"] });

      expect(list).toHaveBeenCalledTimes(1);
      expect(list.mock.calls[0][0].namespace).toBeUndefined();
    });

    it("shows no progress for a load that fits in a single page", async () => {
      const a = objectNamed("a");
      const gate = deferred<KubeObject[]>();
      const list = vi.fn(({ onPage }: { onPage?: (page: unknown) => void }) => {
        onPage?.({ items: [a], loaded: 1 });

        return gate.promise;
      });
      const store = new RealLoadItemsKubeObjectStore({ isNamespaced: true, list });

      const loading = store.loadAll({});
      await vi.advanceTimersByTimeAsync(1000);

      expect(store.items.map((item) => item.getName())).toEqual(["a"]);
      expect(store.loadingProgress).toBeUndefined();

      gate.resolve([a]);
      await loading;

      expect(store.loadingProgress).toBeUndefined();
      expect(store.isLoaded).toBe(true);
    });
  });

  describe("updateFromEventsBuffer", () => {
    const data = (uid: string, resourceVersion = "1", name = uid): KubeJsonApiDataFor<KubeObject> => ({
      apiVersion: "v1",
      kind: "Test",
      metadata: { uid, name, resourceVersion, selfLink: `/test/${uid}` },
    });
    let store: FakeKubeObjectStore;
    let itemsChanged = vi.fn<() => void>();
    let stopObserving: () => void;

    beforeEach(() => {
      vi.useFakeTimers();
      store = new FakeKubeObjectStore(() => [], { objectConstructor: KubeObject });
      store.items.replace(["a", "b", "c", "d"].map((uid) => new KubeObject(data(uid))));
      itemsChanged = vi.fn<() => void>();
      stopObserving = observe(store.items, itemsChanged);
    });

    afterEach(() => {
      stopObserving();
      vi.clearAllTimers();
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it("replaces a modified middle item without moving it", () => {
      const before = store.getItems();

      store["eventsBuffer"].push({ type: "MODIFIED", object: { ...data("b", "2"), status: { ready: true } } });
      store["updateFromEventsBuffer"]();

      expect(store.items.map((item) => item.getId())).toEqual(["a", "b", "c", "d"]);
      expect(store.items[1]).not.toBe(before[1]);
      expect(store.items[1]).toBeInstanceOf(KubeObject);
      expect(store.items[1].status).toEqual({ ready: true });
      expect(store.items[0]).toBe(before[0]);
      expect(store.items[2]).toBe(before[2]);
      expect(store.items[3]).toBe(before[3]);
    });

    it.each(["ADDED", "MODIFIED"] as const)(
      "keeps the object and does not publish a same-version %s replay",
      (type) => {
        const before = store.items[1];
        const construct = vi.spyOn(store.api, "objectConstructor");

        store["eventsBuffer"].push({ type, object: data("b") });
        store["updateFromEventsBuffer"]();

        expect(store.items[1]).toBe(before);
        expect(construct).not.toHaveBeenCalled();
        expect(itemsChanged).not.toHaveBeenCalled();
        expect(store["eventsBuffer"]).toHaveLength(0);
      },
    );

    it("does not treat empty resource versions as a replay", () => {
      const before = new KubeObject(data("b", ""));

      store.items.replace([before]);
      store["eventsBuffer"].push({ type: "MODIFIED", object: data("b", "") });
      store["updateFromEventsBuffer"]();

      expect(store.items[0]).not.toBe(before);
    });

    it("compacts two deletions without holes or sorting", () => {
      const before = store.getItems();
      const sort = vi.spyOn(store, "sortItems" as never);

      store["eventsBuffer"].push({ type: "DELETED", object: data("a") }, { type: "DELETED", object: data("c") });
      store["updateFromEventsBuffer"]();

      expect(store.getItems()).toEqual([before[1], before[3]]);
      expect(sort).not.toHaveBeenCalled();
    });

    it("sorts an inserted item into place", () => {
      const sort = vi.spyOn(store, "sortItems" as never);

      store["eventsBuffer"].push({ type: "ADDED", object: data("aa") });
      store["updateFromEventsBuffer"]();

      expect(store.items.map((item) => item.getId())).toEqual(["a", "aa", "b", "c", "d"]);
      expect(sort).toHaveBeenCalledTimes(1);
    });

    it("does not sort a status-only modification", () => {
      const sort = vi.spyOn(store, "sortItems" as never);

      store["eventsBuffer"].push({ type: "MODIFIED", object: { ...data("b", "2"), status: { ready: true } } });
      store["updateFromEventsBuffer"]();

      expect(store.items[1].status).toEqual({ ready: true });
      expect(sort).not.toHaveBeenCalled();
    });

    it("sorts when the default sort key changes", () => {
      const sort = vi.spyOn(store, "sortItems" as never);

      store["eventsBuffer"].push({ type: "MODIFIED", object: data("b", "2", "z") });
      store["updateFromEventsBuffer"]();

      expect(store.items.map((item) => item.getId())).toEqual(["a", "c", "d", "b"]);
      expect(sort).toHaveBeenCalledTimes(1);
    });

    it("ignores ERROR events without publishing items", () => {
      store["eventsBuffer"].push({ type: "ERROR" });
      store["updateFromEventsBuffer"]();

      expect(store.items.map((item) => item.getId())).toEqual(["a", "b", "c", "d"]);
      expect(itemsChanged).not.toHaveBeenCalled();
    });

    it("warns and skips events without a uid", () => {
      const warn = vi.spyOn(store["dependencies"].logger, "warn");
      const event = { type: "MODIFIED" as const, object: data("") };

      store["eventsBuffer"].push(event);
      store["updateFromEventsBuffer"]();

      expect(warn).toHaveBeenCalledWith("[KUBE-STORE]: watch event did not have defined .metadata.uid, skipping", {
        event,
      });
      expect(itemsChanged).not.toHaveBeenCalled();
    });

    it("caps the list before sorting", () => {
      store = new FakeKubeObjectStore(() => [], { objectConstructor: KubeObject }, { bufferSize: 2 });
      store.items.replace(["b", "c"].map((uid) => new KubeObject(data(uid))));
      store["eventsBuffer"].push({ type: "ADDED", object: data("a") });
      store["updateFromEventsBuffer"]();

      expect(store.items.map((item) => item.getId())).toEqual(["a", "c"]);
    });

    it("does not cap the list by default", () => {
      // No bufferSize option: clusters with more objects of one kind than
      // any fixed cap must not silently lose the head of the sorted list.
      expect(store.bufferSize).toBe(Infinity);

      store["eventsBuffer"].push({ type: "ADDED", object: data("e") });
      store["updateFromEventsBuffer"]();

      expect(store.items.map((item) => item.getId())).toEqual(["a", "b", "c", "d", "e"]);
    });

    it("handles deletion, reinsertion and repeated updates of a uid in one batch", () => {
      store["eventsBuffer"].push(
        { type: "DELETED", object: data("b") },
        { type: "ADDED", object: data("b", "2") },
        { type: "MODIFIED", object: data("b", "3") },
        { type: "DELETED", object: data("a") },
        { type: "DELETED", object: data("a") },
        { type: "MODIFIED", object: data("d", "2") },
      );
      store["updateFromEventsBuffer"]();

      expect(store.items.map((item) => [item.getId(), item.getResourceVersion()])).toEqual([
        ["b", "3"],
        ["c", "1"],
        ["d", "2"],
      ]);
    });

    it("rebuilds the index after items are replaced between flushes", () => {
      store["eventsBuffer"].push({ type: "MODIFIED", object: data("b", "2") });
      store["updateFromEventsBuffer"]();
      store.items.replace([new KubeObject(data("d")), new KubeObject(data("e"))]);
      store["eventsBuffer"].push({ type: "MODIFIED", object: data("e", "2") });
      store["updateFromEventsBuffer"]();

      expect(store.items.map((item) => [item.getId(), item.getResourceVersion()])).toEqual([
        ["d", "1"],
        ["e", "2"],
      ]);
    });

    it("keeps sorting for an inherited custom comparator without a sort key", () => {
      class CustomSortStore extends FakeKubeObjectStore {
        protected sortItems(items: KubeObject[]) {
          return super.sortItems(items, [(item) => item.metadata.labels?.rank]);
        }
      }
      class InheritedSortStore extends CustomSortStore {}

      store = new InheritedSortStore(() => [], { objectConstructor: KubeObject });
      store.items.replace(
        ["a", "b"].map(
          (uid) => new KubeObject({ ...data(uid), metadata: { ...data(uid).metadata, labels: { rank: uid } } }),
        ),
      );
      const sort = vi.spyOn(store, "sortItems" as never);

      store["eventsBuffer"].push({
        type: "MODIFIED",
        object: { ...data("a", "2"), metadata: { ...data("a", "2").metadata, labels: { rank: "z" } } },
      });
      store["updateFromEventsBuffer"]();

      expect(store.items.map((item) => item.getId())).toEqual(["b", "a"]);
      expect(sort).toHaveBeenCalledTimes(1);
    });
  });

  describe("patch and update", () => {
    const data = (uid: string, resourceVersion = "1", name = uid): KubeJsonApiDataFor<KubeObject> => ({
      apiVersion: "v1",
      kind: "Test",
      metadata: { uid, name, resourceVersion, selfLink: `/test/${uid}` },
    });
    let returned: KubeJsonApiDataFor<KubeObject>;
    let store: FakeKubeObjectStore;

    beforeEach(() => {
      vi.useFakeTimers();
      store = new FakeKubeObjectStore(() => [], {
        objectConstructor: KubeObject,
        patch: async () => new KubeObject(returned),
        update: async () => new KubeObject(returned),
      });
      store.items.replace(["a", "b", "c", "d"].map((uid) => new KubeObject(data(uid))));
    });

    afterEach(() => {
      vi.clearAllTimers();
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    const ids = () => store.items.map((item) => item.getId());
    const write = {
      patch: (item: KubeObject) => store.patch(item, []),
      update: (item: KubeObject) => store.update(item, {}),
    };

    describe.each(["patch", "update"] as const)("%s", (method) => {
      it("sorts when the sort key changes, and the list stays sorted through the watch replay", async () => {
        returned = data("b", "2", "z");
        await write[method](store.items[1]);

        expect(ids()).toEqual(["a", "c", "d", "b"]);

        store["eventsBuffer"].push({ type: "MODIFIED", object: data("b", "2", "z") });
        store["updateFromEventsBuffer"]();
        store["eventsBuffer"].push({ type: "MODIFIED", object: { ...data("b", "3", "z"), status: { ready: true } } });
        store["updateFromEventsBuffer"]();

        expect(ids()).toEqual(["a", "c", "d", "b"]);
        expect(store.items[3].getResourceVersion()).toBe("3");
      });

      it("replaces the item in place without sorting when the sort key does not change", async () => {
        const sort = vi.spyOn(store, "sortItems" as never);

        returned = { ...data("b", "2"), status: { ready: true } };
        await write[method](store.items[1]);

        expect(ids()).toEqual(["a", "b", "c", "d"]);
        expect(store.items[1].status).toEqual({ ready: true });
        expect(sort).not.toHaveBeenCalled();
      });

      it("sorts an item that was not in the store into place", async () => {
        returned = data("bb");
        await write[method](new KubeObject(data("bb")));

        expect(ids()).toEqual(["a", "b", "bb", "c", "d"]);
      });
    });
  });

  describe("resuming a watch from the version the store holds", () => {
    const podNamed = (name: string, resourceVersion: string, namespace?: string) =>
      new KubeObject({
        apiVersion: "v1",
        kind: "Foo",
        metadata: {
          name,
          resourceVersion,
          uid: `uid-${name}`,
          ...(namespace ? { namespace } : {}),
          selfLink: `/some/self/link/${name}`,
        },
      });

    type WatchOptions = KubeApiWatchOptions<KubeObject, KubeJsonApiDataFor<KubeObject>>;

    /**
     * An API that remembers one version per namespace for every caller, as
     * KubeApi does, lists the given objects at a version, and serves a watch
     * by replaying the events of `history` newer than the version it starts
     * from.
     */
    const createServer = ({ isNamespaced = false } = {}) => {
      const remembered = new Map<string, string>();
      const state = {
        listed: new Map<string, { items: KubeObject[]; version: string }>(),
        history: [] as Array<{ type: string; object: KubeObject; version: number }>,
      };
      const watchOptions: WatchOptions[] = [];
      const list = vi.fn(
        async ({ namespace = "", onPage }: { namespace?: string; onPage?: (page: unknown) => void } = {}) => {
          const { items, version } = state.listed.get(namespace) ?? state.listed.get("") ?? { items: [], version: "1" };

          remembered.set(namespace, version);
          remembered.set("", version);
          onPage?.({ items, loaded: items.length, remainingItemCount: 0, resourceVersion: version, done: true });

          return items;
        },
      );
      const startWatch = (opts: WatchOptions) => {
        watchOptions.push(opts);

        const startVersion = Number(opts.getResourceVersion?.() ?? remembered.get(opts.namespace ?? ""));

        for (const event of state.history.filter((event) => event.version > startVersion)) {
          opts.callback?.(
            {
              type: event.type,
              object: {
                ...event.object,
                metadata: { ...event.object.metadata, resourceVersion: String(event.version) },
              },
            } as never,
            null,
          );
        }

        return noop;
      };
      const watch = vi.fn((opts: WatchOptions) => startWatch(opts));
      const api = {
        isNamespaced,
        list,
        watch,
        getResourceVersion: (namespace = "") => remembered.get(namespace),
        setResourceVersion: (namespace: string, version: string) => remembered.set(namespace, version),
      } as unknown as Partial<KubeApi<KubeObject>>;

      return { api, state, remembered, watch, list, watchOptions, startWatch };
    };

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.clearAllTimers();
      vi.useRealTimers();
    });

    it("keeps resuming from what the store holds after another list moves the API's version on", async () => {
      const { api, state, remembered, watchOptions } = createServer();
      const store = new RealLoadItemsKubeObjectStore(api);

      state.listed.set("", { items: [podNamed("a", "5"), podNamed("b", "6")], version: "10" });
      await store.loadAll({});
      store.subscribe();
      await vi.advanceTimersByTimeAsync(0);

      expect(watchOptions).toHaveLength(1);
      expect(watchOptions[0].getResourceVersion?.()).toBe("10");

      // An unrelated list of the same API, such as an extension's
      remembered.set("", "20");

      expect(watchOptions[0].getResourceVersion?.()).toBe("10");
    });

    it("does not miss a delete when a restarted watch finds the API's version moved past it", async () => {
      const { api, state, remembered, startWatch, watchOptions } = createServer();
      const store = new RealLoadItemsKubeObjectStore(api);
      const [a, b] = [podNamed("a", "5"), podNamed("b", "6")];

      state.listed.set("", { items: [a, b], version: "10" });
      await store.loadAll({});
      store.subscribe();
      await vi.advanceTimersByTimeAsync(0);

      // b is deleted while the stream is down, and an unrelated list then
      // moves the API's version past the delete.
      state.history.push({ type: "DELETED", object: b, version: 15 });
      remembered.set("", "20");

      // KubeApi restarts a dropped watch with the options it started with
      startWatch(watchOptions[0]);
      await vi.advanceTimersByTimeAsync(1000);

      expect(store.items.map((item) => item.getName())).toEqual(["a"]);
    });

    it("advances with the events and bookmarks it receives, and never back on a replay", async () => {
      const { api, state, watchOptions } = createServer();
      const store = new RealLoadItemsKubeObjectStore(api);

      state.listed.set("", { items: [podNamed("a", "5")], version: "10" });
      await store.loadAll({});
      store.subscribe();
      await vi.advanceTimersByTimeAsync(0);

      const [{ callback, onBookmark, getResourceVersion }] = watchOptions;
      const event = (version: string) =>
        ({ type: "MODIFIED", object: podNamed("a", version) }) as unknown as Parameters<
          NonNullable<typeof callback>
        >[0];

      callback?.(event("12"), null);
      expect(getResourceVersion?.()).toBe("12");

      onBookmark?.("14");
      expect(getResourceVersion?.()).toBe("14");

      // a restarted stream replays what it had sent
      callback?.(event("11"), null);
      expect(getResourceVersion?.()).toBe("14");
    });

    it.each([
      ["an HTTP 410", () => new Response(null, { status: 410 })],
      [
        "a 410 status event",
        () => new KubeStatus({ kind: "Status", apiVersion: "v1", code: 410, status: "Failure" } as never),
      ],
    ])("lists again on %s and watches from the new list", async (_name, makeError) => {
      const { api, state, watch, list, watchOptions } = createServer();
      const store = new RealLoadItemsKubeObjectStore(api);

      state.listed.set("", { items: [podNamed("a", "5")], version: "10" });
      await store.loadAll({});
      store.subscribe();
      await vi.advanceTimersByTimeAsync(0);

      expect(list).toHaveBeenCalledTimes(1);

      state.listed.set("", { items: [podNamed("c", "28")], version: "30" });
      watchOptions[0].callback?.(null, makeError());
      await vi.advanceTimersByTimeAsync(1000);

      expect(list).toHaveBeenCalledTimes(2);
      expect(watch).toHaveBeenCalledTimes(2);
      expect(watchOptions[1].getResourceVersion?.()).toBe("30");
      expect(store.items.map((item) => item.getName())).toEqual(["c"]);
    });

    it("holds one version per namespace when only some namespaces are loaded", async () => {
      const { api, state, remembered, watchOptions } = createServer({ isNamespaced: true });
      const store = new RealLoadItemsKubeObjectStore(api, () => false);

      state.listed.set("ns1", { items: [podNamed("a", "5", "ns1")], version: "10" });
      state.listed.set("ns2", { items: [podNamed("b", "6", "ns2")], version: "12" });
      await store.loadAll({ namespaces: ["ns1", "ns2"] });
      remembered.set("ns1", "99");
      remembered.set("ns2", "99");
      store.subscribe();
      await vi.advanceTimersByTimeAsync(0);

      expect(watchOptions.map((opts) => [opts.namespace, opts.getResourceVersion?.()]).sort()).toEqual([
        ["ns1", "10"],
        ["ns2", "12"],
      ]);
    });

    it("forgets what it held when it is reset, and falls back to the API's version", async () => {
      const { api, state, remembered } = createServer();
      const store = new RealLoadItemsKubeObjectStore(api);

      state.listed.set("", { items: [podNamed("a", "5")], version: "10" });
      await store.loadAll({});
      store.reset();
      remembered.set("", "20");

      expect(store["watchedVersion"]("")).toBe("20");
    });
  });

  describe("subscribe", () => {
    const createWatchedStore = () => {
      const watchSignals: AbortSignal[] = [];
      const watchCallbacks: Array<(data: null, error: unknown) => void> = [];
      const watch = vi.fn((opts: KubeApiWatchOptions<KubeObject, KubeJsonApiDataFor<KubeObject>>) => {
        // Like KubeApi.watch, which wraps the controller it is given
        const controller = new WrappedAbortController(opts.abortController);

        watchSignals.push(controller.signal);
        watchCallbacks.push(opts.callback as (data: null, error: unknown) => void);

        return () => controller.abort();
      });
      const store = new FakeKubeObjectStore(() => [], {
        isNamespaced: false,
        getResourceVersion: () => "1",
        watch,
      });

      return { store, watch, watchSignals, watchCallbacks };
    };

    afterEach(() => {
      vi.useRealTimers();
    });

    it("aborts the watch request when the subscription is disposed", async () => {
      const { store, watchSignals } = createWatchedStore();

      await store.loadAll({});

      const unsubscribe = store.subscribe();

      expect(watchSignals).toHaveLength(1);
      expect(watchSignals[0].aborted).toBe(false);

      unsubscribe();

      expect(watchSignals[0].aborted).toBe(true);
    });

    it("aborts the watch request when the controller it was given aborts", async () => {
      const { store, watchSignals } = createWatchedStore();
      const abortController = new AbortController();

      await store.loadAll({});
      store.subscribe({ abortController });
      abortController.abort();

      expect(watchSignals).toHaveLength(1);
      expect(watchSignals[0].aborted).toBe(true);
    });

    it("does not start a watch for a controller that has already aborted", async () => {
      const { store, watch } = createWatchedStore();
      const abortController = new AbortController();

      await store.loadAll({});
      abortController.abort();
      store.subscribe({ abortController });

      expect(watch).not.toHaveBeenCalled();
    });

    it("aborts a watch request restarted after an error when the subscription is disposed", async () => {
      const { store, watchSignals, watchCallbacks } = createWatchedStore();

      await store.loadAll({});
      vi.useFakeTimers();

      const unsubscribe = store.subscribe();

      watchCallbacks[0](null, new Error("stream broke"));
      vi.advanceTimersByTime(5000);

      expect(watchSignals).toHaveLength(2);
      expect(watchSignals[1].aborted).toBe(false);

      unsubscribe();

      expect(watchSignals.every((signal) => signal.aborted)).toBe(true);
    });

    it("does not restart a watch request that failed because it was aborted", async () => {
      const { store, watch, watchCallbacks } = createWatchedStore();

      await store.loadAll({});
      vi.useFakeTimers();

      const unsubscribe = store.subscribe();

      unsubscribe();
      // the fetch of an aborted watch rejects with a DOMException
      watchCallbacks[0](null, new DOMException("signal is aborted without reason", "AbortError"));
      vi.advanceTimersByTime(60_000);

      expect(watch).toHaveBeenCalledTimes(1);
    });
  });
});
