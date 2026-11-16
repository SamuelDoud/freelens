/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeObject, KubeStatus } from "@freelensapp/kube-object";
import { noop, WrappedAbortController } from "@freelensapp/utilities";
import { observable, runInAction } from "mobx";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KubeObjectStore, releaseFromItemCount, releaseKeepsLoadedCount } from "../../common/k8s-api/kube-object.store";
import { KubeWatchApi, storeLingerMs } from "./kube-watch-api";

import type { KubeApi, KubeApiWatchOptions } from "@freelensapp/kube-api";
import type { KubeJsonApiDataFor } from "@freelensapp/kube-object";
import type { Logger } from "@freelensapp/logger";

type WatchOptions = KubeApiWatchOptions<KubeObject, KubeJsonApiDataFor<KubeObject>>;

const logger: Logger = { debug: noop, error: noop, info: noop, silly: noop, warn: noop };

const objectIn = (namespace: string, name: string, resourceVersion = "1") =>
  new KubeObject({
    apiVersion: "v1",
    kind: "Foo",
    metadata: {
      name,
      namespace,
      resourceVersion,
      uid: `uid-${namespace}-${name}`,
      selfLink: `/api/v1/namespaces/${namespace}/foos/${name}`,
    },
  });

/**
 * The real store and the real KubeWatchApi against a fake API server that
 * counts the lists it is asked for and keeps the watches it is given.
 */
const createEnvironment = ({ namespaces = ["default"], objectsPerNamespace = 3 } = {}) => {
  const allNamespaces = ["default", "kube-system", "other"];
  const selected = observable.box<string[]>(namespaces);
  const clusterContext = {
    allNamespaces,
    get contextNamespaces() {
      return selected.get();
    },
    get hasSelectedAll() {
      return allNamespaces.every((namespace) => selected.get().includes(namespace));
    },
    isLoadingAll: (given: string[]) => allNamespaces.every((namespace) => given.includes(namespace)),
    isGlobalWatchEnabled: () => false,
    isGlobalListEnabled: () => false,
  };
  const server = new Map<string, KubeObject[]>(
    allNamespaces.map((namespace) => [
      namespace,
      Array.from({ length: objectsPerNamespace }, (_, index) => objectIn(namespace, `item-${index}`)),
    ]),
  );
  let version = 100;
  const remembered = new Map<string, string>();
  const lists: string[] = [];
  const pendingLists = new Map<string, () => void>();
  const holdLists = new Set<string>();
  const failLists = new Set<string>();
  const watches: Array<{ namespace: string; signal: AbortSignal; opts: WatchOptions }> = [];
  const api = {
    isNamespaced: true,
    apiBase: "/api/v1/foos",
    kind: "Foo",
    objectConstructor: KubeObject,
    list: vi.fn(
      async ({
        namespace = "",
        onPage,
        reqInit,
      }: {
        namespace?: string;
        onPage?: (page: unknown) => void;
        reqInit?: RequestInit;
      }) => {
        lists.push(namespace);

        if (holdLists.has(namespace)) {
          await new Promise<void>((resolve) => pendingLists.set(namespace, resolve));
        }

        reqInit?.signal?.throwIfAborted();

        if (failLists.has(namespace)) {
          throw new Error(`forbidden: ${namespace}`);
        }

        const items = namespace ? (server.get(namespace) ?? []) : [...server.values()].flat();
        const resourceVersion = String(++version);

        remembered.set(namespace, resourceVersion);
        remembered.set("", resourceVersion);
        onPage?.({ items, loaded: items.length, remainingItemCount: 0, resourceVersion, done: true });

        return items;
      },
    ),
    get: vi.fn(async ({ name, namespace }: { name: string; namespace: string }) => objectIn(namespace, name, "900")),
    watch: vi.fn((opts: WatchOptions) => {
      const controller = new WrappedAbortController(opts.abortController);

      watches.push({ namespace: opts.namespace ?? "", signal: controller.signal, opts });

      return () => controller.abort();
    }),
    getResourceVersion: (namespace = "") => remembered.get(namespace),
    setResourceVersion: (namespace: string, resourceVersion: string) => remembered.set(namespace, resourceVersion),
  };
  const store = new KubeObjectStore<KubeObject>(
    { context: clusterContext, logger },
    api as unknown as KubeApi<KubeObject>,
  );
  const kubeWatchApi = new KubeWatchApi({ clusterContext, logger });

  return {
    api,
    store,
    kubeWatchApi,
    server,
    allNamespaces,
    lists,
    watches,
    openWatches: () => watches.filter((watch) => !watch.signal.aborted),
    select: (next: string[]) => runInAction(() => selected.set(next)),
    names: () => store.items.map((item) => `${item.getNs()}/${item.getName()}`).sort(),
    holdList: (namespace: string) => holdLists.add(namespace),
    failList: (namespace: string) => failLists.add(namespace),
    releaseList: async (namespace: string) => {
      holdLists.delete(namespace);
      pendingLists.get(namespace)?.();
      pendingLists.delete(namespace);
      await vi.advanceTimersByTimeAsync(0);
    },
    emit: async (index: number, type: "ADDED" | "MODIFIED" | "DELETED", object: KubeObject) => {
      watches[index].opts.callback?.({ type, object } as never, null);
      await vi.advanceTimersByTimeAsync(1000);
    },
    settle: () => vi.advanceTimersByTimeAsync(0),
  };
};

describe("KubeWatchApi with a store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("lists once for a view that is left and returned to five times within the linger", async () => {
    const { kubeWatchApi, store, lists, openWatches, names, settle } = createEnvironment();
    let unsubscribe = kubeWatchApi.subscribeStores([store]);

    await settle();

    for (let visit = 0; visit < 5; visit++) {
      unsubscribe();
      await vi.advanceTimersByTimeAsync(30_000);
      unsubscribe = kubeWatchApi.subscribeStores([store]);
      await settle();
    }

    // one list at the first visit, none at the five returns (six before)
    expect(lists).toEqual(["default"]);
    expect(openWatches()).toHaveLength(1);
    expect(store.isLoaded).toBe(true);
    expect(names()).toEqual(["default/item-0", "default/item-1", "default/item-2"]);
  });

  it("shows the changes that happened while the view was away, delivered by the lingering watch", async () => {
    const { kubeWatchApi, store, lists, emit, names, settle } = createEnvironment();
    const unsubscribe = kubeWatchApi.subscribeStores([store]);

    await settle();
    unsubscribe();

    await emit(0, "ADDED", objectIn("default", "new", "200"));
    await emit(0, "DELETED", objectIn("default", "item-1", "201"));
    await emit(0, "MODIFIED", objectIn("default", "item-2", "202"));

    kubeWatchApi.subscribeStores([store]);
    await settle();

    expect(lists).toEqual(["default"]);
    expect(names()).toEqual(["default/item-0", "default/item-2", "default/new"]);
    expect(store.items.find((item) => item.getName() === "item-2")?.metadata.resourceVersion).toBe("202");
  });

  it("lists again, as for a visible store, when the lingering watch expires, and a returning view then finds the new list", async () => {
    const { kubeWatchApi, store, lists, watches, server, names, settle } = createEnvironment();
    const unsubscribe = kubeWatchApi.subscribeStores([store]);

    await settle();
    unsubscribe();

    // the watch has expired: the server answers 410 Gone, and the store lists again
    server.set("default", [objectIn("default", "only", "300")]);
    watches[0].opts.callback?.(
      null,
      new KubeStatus({ kind: "Status", apiVersion: "v1", code: 410, status: "Failure" } as never),
    );
    await vi.advanceTimersByTimeAsync(1500);

    expect(lists).toEqual(["default", "default"]);
    expect(names()).toEqual(["default/only"]);
    // and watches again from the new list
    expect(watches).toHaveLength(2);
    expect(watches[1].opts.getResourceVersion?.()).toBe("102");

    kubeWatchApi.subscribeStores([store]);
    await settle();

    expect(lists).toEqual(["default", "default"]);
  });

  it("frees a large store when the linger is over and loads it afresh for the next view", async () => {
    const { kubeWatchApi, store, lists, openWatches, names, settle } = createEnvironment({
      objectsPerNamespace: releaseFromItemCount,
    });
    const unsubscribe = kubeWatchApi.subscribeStores([store]);

    await settle();

    expect(store.items).toHaveLength(releaseFromItemCount);

    unsubscribe();
    await vi.advanceTimersByTimeAsync(storeLingerMs);

    expect(openWatches()).toHaveLength(0);
    expect(store.items).toHaveLength(0);
    expect(store.isLoaded).toBe(false);

    kubeWatchApi.subscribeStores([store]);
    await settle();

    expect(lists).toEqual(["default", "default"]);
    expect(store.isLoaded).toBe(true);
    expect(names()).toHaveLength(releaseFromItemCount);
    expect(openWatches()).toHaveLength(1);
  });

  it("keeps the objects a panel loaded by name when the linger of a large store is over", async () => {
    const { kubeWatchApi, store, names, settle } = createEnvironment({ objectsPerNamespace: releaseFromItemCount });
    const unsubscribe = kubeWatchApi.subscribeStores([store]);

    await settle();

    // a details panel asks for one secret by name, and for one that the list holds
    await store.load({ name: "token", namespace: "default" });
    await store.load({ name: "item-5", namespace: "default" });
    unsubscribe();
    await vi.advanceTimersByTimeAsync(storeLingerMs);

    expect(store.isLoaded).toBe(false);
    expect(names()).toEqual(["default/item-5", "default/token"]);
    // the panel still finds them
    expect(store.getByName("token", "default")).toBeDefined();
  });

  it("keeps only the latest individually loaded objects, so that they cannot regrow what a release frees", async () => {
    const { store } = createEnvironment({ objectsPerNamespace: releaseFromItemCount });
    const extra = releaseKeepsLoadedCount + 100;

    for (let index = 0; index < extra; index++) {
      await store.load({ name: `loaded-${index}`, namespace: "default" });
    }

    for (let index = 0; index < releaseFromItemCount; index++) {
      store.items.push(objectIn("default", `listed-${index}`));
    }

    store.release();

    expect(store.items).toHaveLength(releaseKeepsLoadedCount);
    expect(store.getByName("loaded-99", "default")).toBeUndefined();
    expect(store.getByName("loaded-100", "default")).toBeDefined();
    expect(store.getByName(`loaded-${extra - 1}`, "default")).toBeDefined();
  });

  it("frees a large store when the last explicit-namespace view ends after the linger of the shared watch", async () => {
    const { kubeWatchApi, store, settle } = createEnvironment({ objectsPerNamespace: releaseFromItemCount });
    const shared = kubeWatchApi.subscribeStores([store]);
    const explicit = kubeWatchApi.subscribeStores([store], { namespaces: ["default"] });

    await settle();
    shared();
    await vi.advanceTimersByTimeAsync(storeLingerMs);

    // the explicit view still uses the items
    expect(store.items).toHaveLength(releaseFromItemCount);

    explicit();

    expect(store.items).toHaveLength(0);
    expect(store.isLoaded).toBe(false);
  });

  it("keeps a large store when an explicit-namespace view ends while the shared watch lingers", async () => {
    const { kubeWatchApi, store, settle } = createEnvironment({ objectsPerNamespace: releaseFromItemCount });
    const shared = kubeWatchApi.subscribeStores([store]);
    const explicit = kubeWatchApi.subscribeStores([store], { namespaces: ["default"] });

    await settle();
    shared();
    explicit();

    expect(store.items).toHaveLength(releaseFromItemCount);
  });

  it("keeps the items of a small store when the linger is over", async () => {
    const { kubeWatchApi, store, settle } = createEnvironment();
    const unsubscribe = kubeWatchApi.subscribeStores([store]);

    await settle();
    unsubscribe();
    await vi.advanceTimersByTimeAsync(storeLingerMs);

    expect(store.items).toHaveLength(3);
    expect(store.isLoaded).toBe(true);
  });

  it("does not let an event that arrives after the release put an item into the emptied store", async () => {
    const { kubeWatchApi, store, watches, settle } = createEnvironment({ objectsPerNamespace: releaseFromItemCount });
    const unsubscribe = kubeWatchApi.subscribeStores([store]);

    await settle();
    unsubscribe();

    // received just before the linger ends, not yet flushed
    watches[0].opts.callback?.({ type: "ADDED", object: objectIn("default", "late", "400") } as never, null);
    await vi.advanceTimersByTimeAsync(storeLingerMs);

    expect(store.items).toHaveLength(0);
  });

  describe("given a load that failed", () => {
    it("tells the view that returns during the linger, not the one that left", async () => {
      const { kubeWatchApi, store, failList, settle } = createEnvironment();
      const leftBehind = vi.fn();
      const returning = vi.fn();

      failList("default");
      const unsubscribe = kubeWatchApi.subscribeStores([store], { onLoadFailure: leftBehind });

      await settle();
      expect(leftBehind).toHaveBeenCalledTimes(1);

      unsubscribe();
      await vi.advanceTimersByTimeAsync(30_000);
      kubeWatchApi.subscribeStores([store], { onLoadFailure: returning });
      await settle();

      expect(returning).toHaveBeenCalledTimes(1);
      expect(leftBehind).toHaveBeenCalledTimes(1);
    });

    it("tells a view that joined the shared watch of another", async () => {
      const { kubeWatchApi, store, failList, select, settle } = createEnvironment();
      const first = vi.fn();
      const second = vi.fn();

      kubeWatchApi.subscribeStores([store], { onLoadFailure: first });
      await settle();
      kubeWatchApi.subscribeStores([store], { onLoadFailure: second });
      failList("kube-system");
      select(["default", "kube-system"]);
      await settle();

      expect(first).toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledTimes(1);
    });
  });

  describe("given every namespace selected", () => {
    it("watches each namespace when the user may not watch cluster-wide", async () => {
      const { kubeWatchApi, store, watches, settle } = createEnvironment({
        namespaces: ["default", "kube-system", "other"],
      });

      kubeWatchApi.subscribeStores([store]);
      await settle();

      expect(watches.map((watch) => watch.namespace).sort()).toEqual(["default", "kube-system", "other"]);
    });

    it("lists and watches a namespace created later, which no cluster-wide watch reports", async () => {
      const { kubeWatchApi, store, watches, lists, server, allNamespaces, select, settle } = createEnvironment({
        namespaces: ["default", "kube-system", "other"],
      });

      kubeWatchApi.subscribeStores([store]);
      await settle();
      server.set("fresh", [objectIn("fresh", "item-0")]);
      allNamespaces.push("fresh");
      select(["default", "kube-system", "other", "fresh"]);
      await settle();

      expect(lists.slice(3)).toEqual(["fresh"]);
      expect(watches.map((watch) => watch.namespace).sort()).toEqual(["default", "fresh", "kube-system", "other"]);
    });

    it("keeps the watch of the selection when another view loads one namespace meanwhile", async () => {
      const { kubeWatchApi, store, watches, holdList, releaseList, settle } = createEnvironment({
        namespaces: ["default", "kube-system", "other"],
      });

      holdList("other");
      kubeWatchApi.subscribeStores([store]);
      await settle();
      // the logs dock of another view loads and watches one namespace
      kubeWatchApi.subscribeStores([store], { namespaces: ["default"] });
      await settle();
      await releaseList("other");

      expect(watches.map((watch) => watch.namespace).sort()).toEqual(["default", "default", "kube-system", "other"]);
    });
  });

  describe("given a selection of namespaces that grows", () => {
    it("lists only the added namespace and ends with the items a full load gives", async () => {
      const { kubeWatchApi, store, lists, openWatches, select, names, settle } = createEnvironment();

      kubeWatchApi.subscribeStores([store]);
      await settle();
      select(["default", "kube-system"]);
      await settle();

      expect(lists).toEqual(["default", "kube-system"]);
      expect(openWatches().map((watch) => watch.namespace)).toEqual(["default", "kube-system"]);

      const incremental = names();
      const fresh = createEnvironment({ namespaces: ["default", "kube-system"] });

      fresh.kubeWatchApi.subscribeStores([fresh.store]);
      await fresh.settle();

      expect(incremental).toEqual(fresh.names());
      expect(incremental).toHaveLength(6);
    });

    it("watches the namespace each group loaded, even when another group's load is under way", async () => {
      const { kubeWatchApi, store, watches, select, holdList, releaseList, settle } = createEnvironment();

      holdList("default");
      kubeWatchApi.subscribeStores([store]);
      await settle();
      select(["default", "kube-system"]);
      await settle();
      // kube-system is loaded and watched while default still lists
      expect(watches.map((watch) => watch.namespace)).toEqual(["kube-system"]);

      await releaseList("default");

      expect(watches.map((watch) => watch.namespace).sort()).toEqual(["default", "kube-system"]);
    });

    it("keeps events of the earlier namespace flowing after the selection grew", async () => {
      const { kubeWatchApi, store, select, emit, names, settle } = createEnvironment();

      kubeWatchApi.subscribeStores([store]);
      await settle();
      select(["default", "kube-system"]);
      await settle();
      await emit(0, "ADDED", objectIn("default", "new", "500"));

      expect(names()).toContain("default/new");
      expect(names()).toContain("kube-system/item-0");
    });

    it("lists the whole selection again when a namespace is removed, and only the added ones when all are selected", async () => {
      const { kubeWatchApi, store, lists, select, settle } = createEnvironment({
        namespaces: ["default", "kube-system"],
      });

      kubeWatchApi.subscribeStores([store]);
      await settle();
      select(["default"]);
      await settle();

      expect(lists).toEqual(["default", "kube-system", "default"]);

      select(["default", "kube-system", "other"]);
      await settle();

      // without a cluster-wide watch, all namespaces are watched one by one,
      // so selecting all only adds the two that were not listed
      expect(lists.slice(3).sort()).toEqual(["kube-system", "other"]);
    });

    it("adds the namespace chosen while the view was away, when it returns, and lists nothing meanwhile", async () => {
      const { kubeWatchApi, store, lists, openWatches, select, names, settle } = createEnvironment();
      const unsubscribe = kubeWatchApi.subscribeStores([store]);

      await settle();
      unsubscribe();
      select(["default", "kube-system"]);
      await vi.advanceTimersByTimeAsync(60_000);

      expect(lists).toEqual(["default"]);

      kubeWatchApi.subscribeStores([store]);
      await settle();

      expect(lists).toEqual(["default", "kube-system"]);
      expect(openWatches()).toHaveLength(2);
      expect(names()).toHaveLength(6);
    });

    it("does not follow a selection made while the view was away after the linger is over", async () => {
      const { kubeWatchApi, store, lists, select, settle } = createEnvironment();
      const unsubscribe = kubeWatchApi.subscribeStores([store]);

      await settle();
      unsubscribe();
      await vi.advanceTimersByTimeAsync(storeLingerMs);
      select(["default", "kube-system"]);
      await settle();

      expect(lists).toEqual(["default"]);
    });
  });
});
