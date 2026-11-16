/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { disposer, getOrInsert, isAbortError, noop, WrappedAbortController } from "@freelensapp/utilities";
import { once } from "es-toolkit";
import { compareShallow, reaction } from "mobx";

import type { Logger } from "@freelensapp/logger";
import type { Disposer } from "@freelensapp/utilities";

import type {
  KubeObjectStoreLoadAllParams,
  KubeObjectStoreSubscribeParams,
} from "../../common/k8s-api/kube-object.store";
import type { ClusterContext } from "../cluster-frame-context/cluster-frame-context";

// Kubernetes watch-api client
// API: https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams

/**
 * How long a store keeps its watches, and its items, after the last view
 * that subscribed to it has gone. A view that comes back within this time
 * finds the store as it was, kept up to date by its watches, without a list.
 */
export const storeLingerMs = 5 * 60 * 1000;

interface SubscribeStoreParams {
  store: SubscribableStore;
  parent: AbortController;
  namespaces: string[] | undefined;
  onLoadFailure?: (err: any) => void;
}

interface WatchStoreParams {
  store: SubscribableStore;
  parent?: AbortController;
  namespaces?: string[];
  onLoadFailure?: (err: any) => void;
}

interface WatchCountDependencies {
  readonly logger: Logger;
}

class WatchCount {
  readonly #data = new Map<SubscribableStore, number>();

  constructor(private readonly dependencies: WatchCountDependencies) {}

  public inc(store: SubscribableStore): number {
    const newCount = getOrInsert(this.#data, store, 0) + 1;

    this.dependencies.logger.debug(`[KUBE-WATCH-API]: inc() count for ${store.api.apiBase} is now ${newCount}`);
    this.#data.set(store, newCount);

    return newCount;
  }

  public dec(store: SubscribableStore): number {
    const oldCount = this.#data.get(store);

    if (oldCount === undefined) {
      throw new Error(`Cannot dec count for store that has never been inc: ${store.api.kind}`);
    }

    const newCount = oldCount - 1;

    if (newCount < 0) {
      throw new Error(`Cannot dec count more times than it has been inc: ${store.api.kind}`);
    }

    this.dependencies.logger.debug(`[KUBE-WATCH-API]: dec() count for ${store.api.apiBase} is now ${newCount}`);
    this.#data.set(store, newCount);

    return newCount;
  }
}

export interface KubeWatchSubscribeStoreOptions {
  /**
   * The namespaces to watch
   * @default all selected namespaces
   */
  namespaces?: string[];

  /**
   * A function that is called when listing fails. If set then blocks errors
   * from rejecting promises
   */
  onLoadFailure?: (err: any) => void;
}

interface Dependencies {
  readonly clusterContext: ClusterContext;
  readonly logger: Logger;
}

export interface SubscribableStore {
  readonly api: {
    readonly isNamespaced: boolean;
    readonly apiBase: string;
    readonly kind: string;
    readonly apiVersionWithGroup?: string;
  };
  loadAll(opts?: KubeObjectStoreLoadAllParams): Promise<unknown>;
  subscribe(opts?: KubeObjectStoreSubscribeParams): Disposer;
  /**
   * Identifies the query the store lists and watches with. When it changes,
   * the store is loaded and watched again.
   */
  readonly listQueryKey?: string;
  /** Whether the last load of the store failed */
  readonly failedLoading?: boolean;
  /**
   * Frees the items of a store nobody is subscribed to any longer, once its
   * linger is over. A store may keep them, when they are too few to matter.
   */
  release?(): void;
}

export type SubscribeStores = (stores: SubscribableStore[], opts?: KubeWatchSubscribeStoreOptions) => Disposer;

/** What `watchStore` hands back: the subscription's end, and its pause while lingering */
interface StoreWatch {
  dispose(): void;
  /** Keeps the watches but stops reloading for changes of selection or query */
  pause(): void;
  /** Brings a paused watch up to date with what changed meanwhile */
  resume(): void;
}

interface WatchGroup {
  readonly controller: AbortController;
  readonly unsubscribe: ReturnType<typeof disposer>;
}

export class KubeWatchApi {
  readonly #watch: WatchCount;
  readonly #sharedWatches = new Map<SubscribableStore, StoreWatch>();
  readonly #lingering = new Map<SubscribableStore, ReturnType<typeof setTimeout>>();
  readonly #ownedWatches = new Map<SubscribableStore, number>();

  constructor(private readonly dependencies: Dependencies) {
    this.#watch = new WatchCount(this.dependencies);
  }

  private subscribeStore({ store, parent, namespaces, onLoadFailure }: SubscribeStoreParams): Disposer {
    if (namespaces) {
      // A watch of the given namespaces belongs to this subscription alone
      this.#ownedWatches.set(store, (this.#ownedWatches.get(store) ?? 0) + 1);

      const watch = this.watchStore({ store, parent, namespaces, onLoadFailure });

      return () => {
        watch.dispose();
        this.#ownedWatches.set(store, (this.#ownedWatches.get(store) ?? 1) - 1);
      };
    }

    // A watch of the selected namespaces is shared by every subscription of
    // the store. The first one starts it, and the last one to be disposed,
    // whichever that is, ends it; no subscription's own controller may.
    if (this.#watch.inc(store) === 1) {
      const lingering = this.#lingering.get(store);

      if (lingering !== undefined) {
        // The watch of the last subscription is still running: take it over.
        clearTimeout(lingering);
        this.#lingering.delete(store);
        this.#sharedWatches.get(store)?.resume();
      } else {
        this.#sharedWatches.set(store, this.watchStore({ store, onLoadFailure }));
      }
    }

    return () => {
      if (this.#watch.dec(store) === 0) {
        this.linger(store);
      }
    };
  }

  /**
   * Keeps the shared watch of a store that lost its last subscription, and
   * with it the items the watch keeps current, for `storeLingerMs`, so that
   * a view that returns in that time needs no list. Then it ends the watch
   * and lets the store free its items, unless a subscription of explicit
   * namespaces still uses them.
   */
  private linger(store: SubscribableStore) {
    this.#sharedWatches.get(store)?.pause();

    this.#lingering.set(
      store,
      setTimeout(() => {
        this.#lingering.delete(store);

        const watch = this.#sharedWatches.get(store);

        this.#sharedWatches.delete(store);
        watch?.dispose();

        if (!this.#ownedWatches.get(store)) {
          store.release?.();
        }
      }, storeLingerMs),
    );
  }

  /**
   * Loads the store and then watches it, for the given namespaces or, when
   * there are none, for the selected ones, following the selection.
   */
  private watchStore({ store, parent, namespaces, onLoadFailure }: WatchStoreParams): StoreWatch {
    const { clusterContext } = this.dependencies;
    const followsSelection = !namespaces;
    const wantedNamespaces = () => namespaces ?? clusterContext.contextNamespaces;
    // The loads and watches of the store, the first for the whole selection
    // and any later ones for the namespaces added to it.
    const groups: WatchGroup[] = [];
    let covered: { namespaces: string[]; all: boolean } | undefined;
    let queryKey = store.listQueryKey;
    let paused = false;
    let changedWhilePaused = false;
    let needsReload = false;

    const loadThenSubscribe = async (
      loadNamespaces: string[],
      watchNamespaces: string[] | undefined,
      { controller, unsubscribe }: WatchGroup,
    ) => {
      try {
        await store.loadAll({
          namespaces: loadNamespaces,
          reqInit: { signal: controller.signal },
          onLoadFailure:
            onLoadFailure &&
            ((error) => {
              needsReload = true;
              onLoadFailure(error);
            }),
        });

        // An aborted load resolves too: the subscription has been disposed,
        // or the namespaces changed and a newer load has taken over. Neither
        // wants a watch from this one.
        if (controller.signal.aborted) {
          return;
        }

        needsReload ||= store.failedLoading === true;
        unsubscribe.push(
          store.subscribe({
            onLoadFailure,
            abortController: controller,
            ...(watchNamespaces && { namespaces: watchNamespaces }),
          }),
        );
      } catch (error) {
        needsReload = true;

        if (!isAbortError(error)) {
          this.log(new Error("Loading stores has failed", { cause: error }), {
            meta: { store, namespaces: loadNamespaces },
          });
        }
      }
    };

    /**
     * Starts a load and a watch of the given namespaces. We don't wait for
     * the load because we want to start reacting to namespace selection
     * changes ASAP
     */
    const startGroup = (loadNamespaces: string[]) => {
      const group: WatchGroup = { controller: new WrappedAbortController(parent), unsubscribe: disposer() };
      // The watches are named, so that another group's or view's load in the
      // meantime cannot change which ones they are: the whole cluster by
      // one watch (an empty list) when that is permitted, else each namespace.
      const watchNamespaces =
        store.api.isNamespaced && loadNamespaces.length > 0
          ? clusterContext.isLoadingAll(loadNamespaces) && clusterContext.isGlobalWatchEnabled()
            ? []
            : loadNamespaces
          : undefined;

      groups.push(group);
      loadThenSubscribe(loadNamespaces, watchNamespaces, group).catch(noop);
    };

    const reload = (reloadNamespaces: string[]) => {
      for (const { controller, unsubscribe } of groups.splice(0)) {
        controller.abort();
        unsubscribe();
      }

      needsReload = false;
      queryKey = store.listQueryKey;
      covered = {
        namespaces: reloadNamespaces.slice(),
        all: store.api.isNamespaced && clusterContext.isLoadingAll(reloadNamespaces),
      };
      startGroup(reloadNamespaces);
    };

    reload(wantedNamespaces());

    /**
     * Follows a change of the selection: namespaces added to it are loaded
     * and watched on their own, and the ones already watched go on, so that
     * only what is new is listed. Any other change loads and watches the
     * whole selection again.
     */
    const followSelection = () => {
      const selected = wantedNamespaces();
      const all = clusterContext.isLoadingAll(selected);

      if (covered?.all && all) {
        return console.debug(
          `[KUBE-WATCH-API]: Not changing watch for ${store.api.apiBase} because a namespace was created or deleted but all namespaces are selected`,
        );
      }

      if (covered && !covered.all && !all) {
        const selectedSet = new Set(selected);
        const coveredSet = new Set(covered.namespaces);

        if (covered.namespaces.every((namespace) => selectedSet.has(namespace))) {
          const added = selected.filter((namespace) => !coveredSet.has(namespace));

          if (added.length > 0) {
            console.log(`[KUBE-WATCH-API]: adding namespaces to watch ${store.api.apiBase}`, added);
            covered.namespaces.push(...added);
            startGroup(added);
          }

          return;
        }
      }

      console.log(`[KUBE-WATCH-API]: changing watch ${store.api.apiBase}`, selected);
      reload(selected);
    };

    const onSelectionChange = () => {
      if (paused) {
        changedWhilePaused = true;
      } else {
        followSelection();
      }
    };

    // A store whose list query changes, such as the pods once completed ones
    // are hidden, lists and watches again with the new query.
    const cancelQueryReloading =
      store.listQueryKey !== undefined
        ? reaction(
            () => store.listQueryKey,
            () => {
              if (paused) {
                changedWhilePaused = true;

                return;
              }

              console.log(`[KUBE-WATCH-API]: list query of ${store.api.apiBase} changed, reloading`);
              reload(wantedNamespaces());
            },
          )
        : noop;

    const cancelReloading =
      followsSelection && store.api.isNamespaced
        ? reaction(
            // Note: must slice because reaction won't fire if it isn't there
            () => [clusterContext.contextNamespaces.slice(), clusterContext.hasSelectedAll] as const,
            onSelectionChange,
            {
              equals: compareShallow,
            },
          )
        : noop; // don't watch namespaces if namespaces were provided

    return {
      dispose: () => {
        cancelQueryReloading();
        cancelReloading();

        for (const { controller, unsubscribe } of groups.splice(0)) {
          controller.abort();
          unsubscribe();
        }
      },
      pause: () => {
        paused = true;
      },
      resume: () => {
        paused = false;

        // A load that failed would be tried again by a view that returns
        // after the watch was ended; so it is by one that returns now.
        if (
          needsReload ||
          store.failedLoading ||
          (store.listQueryKey !== undefined && store.listQueryKey !== queryKey)
        ) {
          console.log(`[KUBE-WATCH-API]: loading ${store.api.apiBase} again`);
          reload(wantedNamespaces());
        } else if (changedWhilePaused) {
          followSelection();
        }

        changedWhilePaused = false;
      },
    };
  }

  subscribeStores: SubscribeStores = (stores, { namespaces, onLoadFailure } = {}) => {
    const parent = new AbortController();
    const unsubscribe = disposer(
      ...stores.map((store) =>
        this.subscribeStore({
          store,
          parent,
          namespaces,
          onLoadFailure,
        }),
      ),
    );

    // unsubscribe
    return once(() => {
      parent.abort();
      unsubscribe();
    });
  };

  protected log(message: any, meta: any) {
    const log = message instanceof Error ? this.dependencies.logger.error : this.dependencies.logger.debug;

    log("[KUBE-WATCH-API]:", message, {
      time: new Date().toLocaleString(),
      ...meta,
    });
  }
}
