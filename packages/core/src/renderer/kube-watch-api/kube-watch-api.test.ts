/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { noop, WrappedAbortController } from "@freelensapp/utilities";
import { observable, runInAction } from "mobx";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KubeWatchApi, lingerBudget, storeLingerMs } from "./kube-watch-api";

import type { Logger } from "@freelensapp/logger";

import type {
  KubeObjectStoreLoadAllParams,
  KubeObjectStoreSubscribeParams,
} from "../../common/k8s-api/kube-object.store";
import type { SubscribableStore } from "./kube-watch-api";

const logger: Logger = {
  debug: noop,
  error: noop,
  info: noop,
  silly: noop,
  warn: noop,
};

// The tests run on fake timers: a store's linger is minutes long.
const flushPromises = () => vi.advanceTimersByTimeAsync(0);
const lingerOver = () => vi.advanceTimersByTimeAsync(storeLingerMs);

/**
 * A store whose lists stay pending until `finishLoads()`, and resolve on an
 * abort like `KubeObjectStore.loadAll` does. Its watches are wrapped the way
 * `KubeApi.watch` wraps the controller it is given.
 */
const createStore = ({ isNamespaced = false, apiBase = "/api/v1/foos", items = 0 } = {}) => {
  const pendingLoads: Array<() => void> = [];
  const watchSignals: AbortSignal[] = [];

  const store = {
    api: {
      isNamespaced,
      apiBase,
      kind: "Foo",
    },
    getTotalCount: () => items,
    loadAll: vi.fn(
      ({ reqInit }: KubeObjectStoreLoadAllParams = {}) =>
        new Promise<undefined>((resolve) => {
          pendingLoads.push(() => resolve(undefined));
          reqInit?.signal?.addEventListener("abort", () => resolve(undefined));
        }),
    ),
    failedLoading: false as boolean,
    release: vi.fn(),
    subscribe: vi.fn(({ abortController }: KubeObjectStoreSubscribeParams = {}) => {
      const watchController = new WrappedAbortController(abortController);

      watchSignals.push(watchController.signal);

      return () => watchController.abort();
    }),
  } satisfies SubscribableStore;

  return {
    store,
    finishLoads: async () => {
      for (const finish of pendingLoads.splice(0)) {
        finish();
      }

      await flushPromises();
    },
    openWatches: () => watchSignals.filter((signal) => !signal.aborted).length,
  };
};

const createKubeWatchApi = () => {
  const clusterContext = observable({
    allNamespaces: ["default", "kube-system"],
    contextNamespaces: ["default"],
    hasSelectedAll: false,
    isLoadingAll: () => false,
    isGlobalWatchEnabled: () => false,
  });

  return {
    clusterContext,
    kubeWatchApi: new KubeWatchApi({ clusterContext, logger }),
  };
};

describe("KubeWatchApi", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("ends the watch of a store once its last subscription has been gone for the linger", async () => {
    const { kubeWatchApi } = createKubeWatchApi();
    const { store, finishLoads, openWatches } = createStore();

    const unsubscribe = kubeWatchApi.subscribeStores([store]);

    await finishLoads();

    expect(openWatches()).toBe(1);

    unsubscribe();

    // kept for a view that comes back
    await vi.advanceTimersByTimeAsync(storeLingerMs - 1);

    expect(openWatches()).toBe(1);

    await vi.advanceTimersByTimeAsync(1);

    expect(openWatches()).toBe(0);
  });

  it("finishes the list of a store whose subscription was disposed while it was loading, and ends its watch with the linger", async () => {
    const { kubeWatchApi } = createKubeWatchApi();
    const { store, finishLoads, openWatches } = createStore();

    const unsubscribe = kubeWatchApi.subscribeStores([store]);

    unsubscribe();
    await finishLoads();

    expect(store.subscribe).toHaveBeenCalledTimes(1);
    expect(openWatches()).toBe(1);

    await lingerOver();

    expect(openWatches()).toBe(0);
  });

  it("leaves one watch open after a mount, an unmount and a remount, and none after the last unmount", async () => {
    const { kubeWatchApi } = createKubeWatchApi();
    const { store, finishLoads, openWatches } = createStore();

    // what React.StrictMode does to every view in development
    const unsubscribeFirst = kubeWatchApi.subscribeStores([store]);

    unsubscribeFirst();

    const unsubscribeSecond = kubeWatchApi.subscribeStores([store]);

    await finishLoads();

    expect(store.subscribe).toHaveBeenCalledTimes(1);
    expect(openWatches()).toBe(1);

    unsubscribeSecond();
    await lingerOver();

    expect(openWatches()).toBe(0);
  });

  it("keeps the shared watch of a store open until its last subscription is disposed", async () => {
    const { kubeWatchApi } = createKubeWatchApi();
    const { store, finishLoads, openWatches } = createStore();

    const unsubscribeFirst = kubeWatchApi.subscribeStores([store]);
    const unsubscribeSecond = kubeWatchApi.subscribeStores([store]);

    await finishLoads();

    expect(store.subscribe).toHaveBeenCalledTimes(1);
    expect(openWatches()).toBe(1);

    unsubscribeFirst();

    expect(openWatches()).toBe(1);

    unsubscribeSecond();
    await lingerOver();

    expect(openWatches()).toBe(0);
  });

  it("ends the shared watch of a store and its namespace reaction with the last subscription", async () => {
    const { kubeWatchApi, clusterContext } = createKubeWatchApi();
    const { store, finishLoads, openWatches } = createStore({ isNamespaced: true });

    const unsubscribeFirst = kubeWatchApi.subscribeStores([store]);
    const unsubscribeSecond = kubeWatchApi.subscribeStores([store]);

    await finishLoads();
    unsubscribeFirst();

    runInAction(() => {
      clusterContext.contextNamespaces = ["kube-system"];
    });
    await finishLoads();

    expect(openWatches()).toBe(1);

    unsubscribeSecond();
    await lingerOver();

    expect(openWatches()).toBe(0);

    runInAction(() => {
      clusterContext.contextNamespaces = ["default"];
    });
    await finishLoads();

    expect(store.loadAll).toHaveBeenCalledTimes(2);
    expect(openWatches()).toBe(0);
  });

  it("leaves one watch open after the namespaces change while the list is loading, and none after disposal", async () => {
    const { kubeWatchApi, clusterContext } = createKubeWatchApi();
    const { store, finishLoads, openWatches } = createStore({ isNamespaced: true });

    const unsubscribe = kubeWatchApi.subscribeStores([store]);

    runInAction(() => {
      clusterContext.contextNamespaces = ["kube-system"];
    });
    await finishLoads();

    expect(store.loadAll).toHaveBeenCalledTimes(2);
    expect(store.subscribe).toHaveBeenCalledTimes(1);
    expect(openWatches()).toBe(1);

    unsubscribe();
    await lingerOver();

    expect(openWatches()).toBe(0);
  });

  it("aborts the restarted watch when the namespaces change after the list loaded", async () => {
    const { kubeWatchApi, clusterContext } = createKubeWatchApi();
    const { store, finishLoads, openWatches } = createStore({ isNamespaced: true });

    const unsubscribe = kubeWatchApi.subscribeStores([store]);

    await finishLoads();

    runInAction(() => {
      clusterContext.contextNamespaces = ["kube-system"];
    });

    expect(openWatches()).toBe(0);

    await finishLoads();

    expect(store.subscribe).toHaveBeenCalledTimes(2);
    expect(openWatches()).toBe(1);

    unsubscribe();
    await lingerOver();

    expect(openWatches()).toBe(0);
  });

  describe("when the last subscription of a store goes", () => {
    const subscribeAndLoad = async (isNamespaced = false) => {
      const created = { ...createKubeWatchApi(), ...createStore({ isNamespaced }) };
      const unsubscribe = created.kubeWatchApi.subscribeStores([created.store]);

      await created.finishLoads();

      return { ...created, unsubscribe };
    };

    it("lets a subscription that returns within the linger take the store as it is, without another list", async () => {
      const { kubeWatchApi, store, openWatches, unsubscribe } = await subscribeAndLoad();

      // navigating away from the view and back, five times
      let last = unsubscribe;

      for (let visit = 0; visit < 5; visit++) {
        last();
        await vi.advanceTimersByTimeAsync(60_000);
        last = kubeWatchApi.subscribeStores([store]);
        await flushPromises();
      }

      expect(store.loadAll).toHaveBeenCalledTimes(1);
      expect(store.subscribe).toHaveBeenCalledTimes(1);
      expect(openWatches()).toBe(1);
      expect(store.release).not.toHaveBeenCalled();

      last();
      await lingerOver();

      expect(openWatches()).toBe(0);
      expect(store.release).toHaveBeenCalledTimes(1);
    });

    it("measures the linger from the last departure, not the first", async () => {
      const { kubeWatchApi, store, openWatches, unsubscribe } = await subscribeAndLoad();

      unsubscribe();
      await vi.advanceTimersByTimeAsync(storeLingerMs - 1000);

      const second = kubeWatchApi.subscribeStores([store]);

      await vi.advanceTimersByTimeAsync(2000);

      expect(openWatches()).toBe(1);

      second();
      await vi.advanceTimersByTimeAsync(storeLingerMs - 1);

      expect(openWatches()).toBe(1);
      expect(store.release).not.toHaveBeenCalled();
    });

    it("loads and watches afresh for a subscription that comes after the linger, and the store was released", async () => {
      const { kubeWatchApi, store, finishLoads, openWatches, unsubscribe } = await subscribeAndLoad();

      unsubscribe();
      await lingerOver();

      expect(store.release).toHaveBeenCalledTimes(1);

      kubeWatchApi.subscribeStores([store]);
      await finishLoads();

      expect(store.loadAll).toHaveBeenCalledTimes(2);
      expect(store.subscribe).toHaveBeenCalledTimes(2);
      expect(openWatches()).toBe(1);
    });

    it("does not release a store that a subscription of explicit namespaces still uses", async () => {
      const { kubeWatchApi, store, finishLoads, openWatches, unsubscribe } = await subscribeAndLoad(true);
      const unsubscribeOwned = kubeWatchApi.subscribeStores([store], { namespaces: ["default"] });

      await finishLoads();
      unsubscribe();
      await lingerOver();

      // the shared watch is over, the one of explicit namespaces goes on
      expect(openWatches()).toBe(1);
      expect(store.release).not.toHaveBeenCalled();

      unsubscribeOwned();
    });

    it("loads the store again for a subscription that returns after its load failed", async () => {
      const { kubeWatchApi, store, finishLoads, unsubscribe } = await subscribeAndLoad();

      store.failedLoading = true;
      unsubscribe();
      await vi.advanceTimersByTimeAsync(1000);
      kubeWatchApi.subscribeStores([store]);
      await finishLoads();

      expect(store.loadAll).toHaveBeenCalledTimes(2);
    });

    it("loads the store again for a subscription that returns after a failure reported by the load", async () => {
      const { kubeWatchApi, store } = { ...createKubeWatchApi(), ...createStore() };
      const onLoadFailure = vi.fn();

      // the store reports the failure of a namespace, empties itself and carries on
      store.loadAll.mockImplementationOnce(async ({ onLoadFailure }: KubeObjectStoreLoadAllParams = {}) => {
        onLoadFailure?.(new Error("forbidden"));

        return undefined;
      });

      const unsubscribe = kubeWatchApi.subscribeStores([store], { onLoadFailure });

      await flushPromises();
      unsubscribe();
      kubeWatchApi.subscribeStores([store], { onLoadFailure });
      await flushPromises();

      expect(onLoadFailure).toHaveBeenCalledTimes(1);
      expect(store.loadAll).toHaveBeenCalledTimes(2);
    });

    it("keeps the selection of the store while away and compares it with what it holds on return", async () => {
      const { kubeWatchApi, clusterContext, store, finishLoads, openWatches, unsubscribe } =
        await subscribeAndLoad(true);

      unsubscribe();
      runInAction(() => {
        clusterContext.contextNamespaces = ["default", "kube-system"];
      });
      await finishLoads();

      // nothing is listed for a store nobody looks at
      expect(store.loadAll).toHaveBeenCalledTimes(1);

      kubeWatchApi.subscribeStores([store]);
      await finishLoads();

      // only the namespace that was added
      expect(store.loadAll).toHaveBeenCalledTimes(2);
      expect(store.loadAll.mock.lastCall?.[0]).toMatchObject({ namespaces: ["kube-system"] });
      expect(openWatches()).toBe(2);
    });

    it("lists the whole selection on return when the selection changed otherwise while away", async () => {
      const { kubeWatchApi, clusterContext, store, finishLoads, openWatches, unsubscribe } =
        await subscribeAndLoad(true);

      unsubscribe();
      runInAction(() => {
        clusterContext.contextNamespaces = ["kube-system"];
      });
      await finishLoads();
      kubeWatchApi.subscribeStores([store]);
      await finishLoads();

      expect(store.loadAll).toHaveBeenCalledTimes(2);
      expect(store.loadAll.mock.lastCall?.[0]).toMatchObject({ namespaces: ["kube-system"] });
      expect(openWatches()).toBe(1);
    });

    it("does nothing on return when the selection went and came back while away", async () => {
      const { kubeWatchApi, clusterContext, store, finishLoads, unsubscribe } = await subscribeAndLoad(true);

      unsubscribe();
      runInAction(() => {
        clusterContext.contextNamespaces = ["kube-system"];
      });
      runInAction(() => {
        clusterContext.contextNamespaces = ["default"];
      });
      kubeWatchApi.subscribeStores([store]);
      await finishLoads();

      expect(store.loadAll).toHaveBeenCalledTimes(1);
    });
  });

  describe("given a selection of namespaces that grows", () => {
    it("lists and watches only the namespace added, and keeps the watch of the others", async () => {
      const { kubeWatchApi, clusterContext } = createKubeWatchApi();
      const { store, finishLoads, openWatches } = createStore({ isNamespaced: true });

      kubeWatchApi.subscribeStores([store]);
      await finishLoads();

      runInAction(() => {
        clusterContext.contextNamespaces = ["default", "kube-system"];
      });

      // the watch of default was not touched
      expect(openWatches()).toBe(1);

      await finishLoads();

      expect(store.loadAll).toHaveBeenCalledTimes(2);
      expect(store.loadAll.mock.lastCall?.[0]).toMatchObject({ namespaces: ["kube-system"] });
      expect(store.subscribe.mock.lastCall?.[0]).toMatchObject({ namespaces: ["kube-system"] });
      expect(openWatches()).toBe(2);
    });

    it("lists the whole selection again when a namespace is removed from it", async () => {
      const { kubeWatchApi, clusterContext } = createKubeWatchApi();
      const { store, finishLoads, openWatches } = createStore({ isNamespaced: true });

      runInAction(() => {
        clusterContext.contextNamespaces = ["default", "kube-system"];
      });
      kubeWatchApi.subscribeStores([store]);
      await finishLoads();

      runInAction(() => {
        clusterContext.contextNamespaces = ["default"];
      });
      await finishLoads();

      expect(store.loadAll).toHaveBeenCalledTimes(2);
      expect(store.loadAll.mock.lastCall?.[0]).toMatchObject({ namespaces: ["default"] });
      expect(openWatches()).toBe(1);
    });

    it("ends every group's watch with the last subscription", async () => {
      const { kubeWatchApi, clusterContext } = createKubeWatchApi();
      const { store, finishLoads, openWatches } = createStore({ isNamespaced: true });

      const unsubscribe = kubeWatchApi.subscribeStores([store]);

      await finishLoads();
      runInAction(() => {
        clusterContext.contextNamespaces = ["default", "kube-system", "other"];
      });
      await finishLoads();

      expect(openWatches()).toBe(2);

      unsubscribe();
      await lingerOver();

      expect(openWatches()).toBe(0);
    });

    it("loads an added namespace while the first one is still loading", async () => {
      const { kubeWatchApi, clusterContext } = createKubeWatchApi();
      const { store, finishLoads, openWatches } = createStore({ isNamespaced: true });

      kubeWatchApi.subscribeStores([store]);
      runInAction(() => {
        clusterContext.contextNamespaces = ["default", "kube-system"];
      });
      await finishLoads();

      expect(store.loadAll).toHaveBeenCalledTimes(2);
      expect(store.subscribe.mock.calls.map(([opts]) => opts?.namespaces).sort()).toEqual([
        ["default"],
        ["kube-system"],
      ]);
      expect(openWatches()).toBe(2);
    });
  });

  describe("given a store whose list query can change", () => {
    const createStoreWithQuery = () => {
      const created = createStore({ isNamespaced: true });
      const listQuery = observable.box("{}");

      Object.defineProperty(created.store, "listQueryKey", { get: () => listQuery.get() });

      return {
        ...created,
        setListQuery: (key: string) => runInAction(() => listQuery.set(key)),
      };
    };

    it("loads and watches it again, for the same namespaces, when the query changes", async () => {
      const { kubeWatchApi } = createKubeWatchApi();
      const { store, finishLoads, openWatches, setListQuery } = createStoreWithQuery();

      const unsubscribe = kubeWatchApi.subscribeStores([store]);

      await finishLoads();

      setListQuery('{"fieldSelector":"status.phase!=Succeeded"}');

      expect(openWatches()).toBe(0);
      expect(store.loadAll).toHaveBeenCalledTimes(2);
      expect(store.loadAll.mock.lastCall?.[0]).toMatchObject({ namespaces: ["default"] });

      await finishLoads();

      expect(store.subscribe).toHaveBeenCalledTimes(2);
      expect(openWatches()).toBe(1);

      unsubscribe();
      await lingerOver();

      expect(openWatches()).toBe(0);
    });

    it("stops following the query with the last subscription", async () => {
      const { kubeWatchApi } = createKubeWatchApi();
      const { store, finishLoads, setListQuery } = createStoreWithQuery();

      const unsubscribe = kubeWatchApi.subscribeStores([store]);

      await finishLoads();
      unsubscribe();
      await lingerOver();
      setListQuery('{"fieldSelector":"status.phase!=Succeeded"}');

      expect(store.loadAll).toHaveBeenCalledTimes(1);
    });
  });

  describe("the budget of the stores that linger", () => {
    const visit = async (kubeWatchApi: KubeWatchApi, index: number, items = 0) => {
      const created = createStore({ apiBase: `/api/v1/kind${index}`, items });
      const unsubscribe = kubeWatchApi.subscribeStores([created.store]);

      await created.finishLoads();
      unsubscribe();

      return created;
    };

    it("ends the longest lingering store when more kinds than the budget linger", async () => {
      const { kubeWatchApi } = createKubeWatchApi();
      const visited = [];

      for (let index = 0; index <= lingerBudget.kinds; index++) {
        visited.push(await visit(kubeWatchApi, index));
      }

      expect(visited[0].openWatches()).toBe(0);
      expect(visited[0].store.release).toHaveBeenCalledTimes(1);
      expect(visited.slice(1).map((each) => each.openWatches())).toEqual(Array(lingerBudget.kinds).fill(1));
      expect(visited[1].store.release).not.toHaveBeenCalled();
    });

    it("keeps a returning store as the most recently used", async () => {
      const { kubeWatchApi } = createKubeWatchApi();
      const first = await visit(kubeWatchApi, 0);

      for (let index = 1; index < lingerBudget.kinds; index++) {
        await visit(kubeWatchApi, index);
      }

      // the first is visited again, and so is no longer the one to go
      kubeWatchApi.subscribeStores([first.store])();
      await visit(kubeWatchApi, 100);

      expect(first.openWatches()).toBe(1);
      expect(first.store.loadAll).toHaveBeenCalledTimes(1);
    });

    it("does not keep a store over the item budget, and ends the older ones to make room", async () => {
      const { kubeWatchApi } = createKubeWatchApi();
      const small = await visit(kubeWatchApi, 0, 10);
      const half = await visit(kubeWatchApi, 1, lingerBudget.items / 2);
      const huge = await visit(kubeWatchApi, 2, lingerBudget.items + 1);

      expect(huge.openWatches()).toBe(0);
      expect(huge.store.release).toHaveBeenCalledTimes(1);
      expect(small.openWatches()).toBe(0);
      expect(half.openWatches()).toBe(0);

      const other = await visit(kubeWatchApi, 3, lingerBudget.items / 2);

      expect(other.openWatches()).toBe(1);
    });

    it("bounds the open watches of the stores kept", async () => {
      const { kubeWatchApi, clusterContext } = createKubeWatchApi();

      clusterContext.contextNamespaces = Array.from({ length: 20 }, (_, index) => `ns${index}`);

      const visitNamespaced = async (index: number) => {
        const created = createStore({ isNamespaced: true, apiBase: `/api/v1/kind${index}` });
        const unsubscribe = kubeWatchApi.subscribeStores([created.store]);

        await created.finishLoads();
        unsubscribe();

        return created;
      };

      const kept = [];

      for (let index = 0; index < 4; index++) {
        kept.push(await visitNamespaced(index));
      }

      // 20 watches each (one per namespace): two fit in the budget of 48,
      // each one after them ends the longest lingering
      expect(kept.map((each) => each.openWatches())).toEqual([0, 0, 1, 1]);
      expect(kept[0].store.release).toHaveBeenCalledTimes(1);
    });
  });
});
