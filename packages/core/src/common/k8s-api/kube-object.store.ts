/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import assert from "node:assert";
import { parseKubeApi } from "@freelensapp/kube-api";
import { KubeStatus } from "@freelensapp/kube-object";
import { includes, isAbortError, noop, object, rejectPromiseBy, waitUntilDefined } from "@freelensapp/utilities";
import autoBind from "auto-bind";
import { limitAsync } from "es-toolkit";
import { action, computed, observable, reaction } from "mobx";
import { ItemStore } from "../item.store";

import type { FetchRequestInit as RequestInit } from "@freelensapp/json-api";
import type {
  DeleteOptions,
  IKubeWatchEvent,
  KubeApi,
  KubeApiListPage,
  KubeApiPatchType,
  KubeApiQueryParams,
  KubeApiWatchCallback,
} from "@freelensapp/kube-api";
import type { KubeJsonApiDataFor, KubeObject } from "@freelensapp/kube-object";
import type { Logger } from "@freelensapp/logger";
import type { Disposer } from "@freelensapp/utilities";

import type { Patch } from "rfc6902";
import type { PartialDeep } from "type-fest";

import type { ClusterContext } from "../../renderer/cluster-frame-context/cluster-frame-context";

export type OnLoadFailure = (error: unknown) => void;

export interface KubeObjectStoreLoadingParams<K extends KubeObject = KubeObject> {
  namespaces: string[];
  reqInit?: RequestInit;

  /**
   * A function that is called when listing fails. If set then blocks errors
   * being rejected with
   */
  onLoadFailure?: OnLoadFailure;

  /**
   * Called with the items received so far while a paginated list is still
   * streaming in, so that the caller can already show them. The items are
   * a snapshot; the completed load remains authoritative.
   */
  onProgress?: (items: K[]) => void;
}

export interface KubeObjectStoreLoadAllParams {
  namespaces?: string[];
  merge?: boolean;
  reqInit?: RequestInit;

  /**
   * A function that is called when listing fails. If set then blocks errors
   * being rejected with
   */
  onLoadFailure?: OnLoadFailure;
}

export interface KubeObjectStoreSubscribeParams {
  /**
   * A function that is called when listing fails. If set then blocks errors
   * being rejected with
   */
  onLoadFailure?: OnLoadFailure;

  /**
   * An optional parent abort controller
   */
  abortController?: AbortController;
}

export interface MergeItemsOptions {
  merge?: boolean;
  updateStore?: boolean;
  sort?: boolean;
  filter?: boolean;
  namespaces: string[];
}

export interface StatusProvider<K> {
  getStatuses(items: K[]): Record<string, number>;
}

export interface KubeObjectStoreOptions {
  limit?: number;
  bufferSize?: number;

  /**
   * Chunk size for paginated list requests: items are fetched, parsed and
   * shown this many at a time instead of in one response.
   *
   * @default 500
   */
  pageSize?: number;
}

export type KubeApiDataFrom<K extends KubeObject, A> =
  A extends KubeApi<K, infer D> ? (D extends KubeJsonApiDataFor<K> ? D : never) : never;

export type JsonPatch = Patch;

export interface KubeObjectStoreDependencies {
  readonly context: ClusterContext;
  readonly logger: Logger;
}

/**
 * User Timing for one store load, for profiling: the DevTools Performance
 * panel shows the measures, and `performance.getEntriesByType("measure")`
 * returns them. `kos first-items <apiBase>` ends when the first items reach
 * the store, `kos load <apiBase>` when the load is complete. Only the latest
 * measure of each name is kept, so a long session does not accumulate them.
 */
function startLoadTiming(apiBase: string, generation: number) {
  const perf = globalThis.performance;
  const startMark = `kos:${apiBase}#${generation}:start`;
  let firstItemsMeasured = false;

  const measure = (name: string) => {
    try {
      perf.clearMeasures(name);
      perf.measure(name, startMark);
    } catch {
      // The start mark is gone (cleared by a reset of the timeline); skip.
    }
  };

  perf?.mark(startMark);

  return {
    firstItems: () => {
      if (!perf || firstItemsMeasured) return;
      firstItemsMeasured = true;
      measure(`kos first-items ${apiBase}`);
    },
    complete: () => {
      if (perf) measure(`kos load ${apiBase}`);
    },
    dispose: () => perf?.clearMarks(startMark),
  };
}

export class KubeObjectStore<
  K extends KubeObject = KubeObject,
  A extends KubeApi<K, D> = KubeApi<K, KubeJsonApiDataFor<K>>,
  D extends KubeJsonApiDataFor<K> = KubeApiDataFrom<K, A>,
> extends ItemStore<K> {
  public readonly limit: number | undefined;
  public readonly bufferSize: number;
  public readonly pageSize: number;

  private readonly loadedNamespaces = observable.box<string[]>();
  private readonly watchingController = new AbortController();
  // Bumped by every loadAll and reset: a progressive publish scheduled by
  // an older (or reset) load must not put its items back into the store.
  private loadGeneration = 0;

  constructor(
    protected readonly dependencies: KubeObjectStoreDependencies,
    public readonly api: A,
    opts?: KubeObjectStoreOptions,
  ) {
    super();
    this.limit = opts?.limit;
    // No cap by default: a fixed cap silently drops the head of the sorted
    // list on clusters with more objects of one kind than the cap. Stores
    // that want a bound pass bufferSize explicitly.
    this.bufferSize = opts?.bufferSize ?? Infinity;
    this.pageSize = opts?.pageSize ?? 500;

    autoBind(this);
    this.bindWatchEventsUpdater();
  }

  // TODO: Circular dependency: KubeObjectStore -> ClusterFrameContext -> NamespaceStore -> KubeObjectStore
  @computed get contextItems(): K[] {
    const namespaces = this.dependencies.context.contextNamespaces;

    return this.items.filter((item) => {
      const itemNamespace = item.getNs();

      return !itemNamespace /* cluster-wide */ || namespaces.includes(itemNamespace);
    });
  }

  getTotalCount(): number {
    return this.contextItems.length;
  }

  /**
   * Identifies the query the store lists and watches with, so that a
   * subscription can load and watch again when it changes.
   */
  get listQueryKey(): string {
    return JSON.stringify(this.query);
  }

  /**
   * The query a watch of this store sends: the list query without `limit`,
   * so that the watch delivers the same objects the list does.
   */
  protected get watchQuery(): KubeApiQueryParams {
    const { limit: _limit, ...query } = this.query;

    return query;
  }

  get query(): KubeApiQueryParams {
    const { limit } = this;

    if (!limit) {
      return {};
    }

    return { limit };
  }

  getAllByNs(namespace: string | string[], strict = false): K[] {
    const namespaces = [namespace].flat();

    if (namespaces.length) {
      return this.items.filter((item) => includes(namespaces, item.getNs()));
    }

    if (!strict) {
      return this.items;
    }

    return [];
  }

  getById(id: string): K | undefined {
    return this.items.find((item) => item.getId() === id);
  }

  getByName(name: string, namespace?: string): K | undefined {
    return this.items.find((item) => item.getName() === name && (namespace ? item.getNs() === namespace : true));
  }

  getByOwnerReference(apiVersion: string | undefined, kind: string, name: string, namespace: string): K[] {
    return this.items.filter((item) => {
      const ownerRefs = item.getOwnerRefs();
      return (
        item.getNs() === namespace &&
        ownerRefs &&
        ownerRefs.filter(
          (ref) => (!apiVersion || ref.apiVersion === apiVersion) && ref.kind === kind && ref.name === name,
        ).length > 0
      );
    });
  }

  getByPath(path: string): K | undefined {
    return this.items.find((item) => item.selfLink === path);
  }

  getByLabel(labels: string[] | Partial<Record<string, string>>): K[] {
    if (Array.isArray(labels)) {
      return this.items.filter((item: K) => {
        const itemLabels = item.getLabels();

        return labels.every((label) => itemLabels.includes(label));
      });
    } else {
      return this.items.filter((item: K) => {
        const itemLabels = item.metadata.labels || {};

        return object.entries(labels).every(([key, value]) => itemLabels[key] === value);
      });
    }
  }

  protected async loadItems({
    namespaces,
    reqInit,
    onLoadFailure,
    onProgress,
  }: KubeObjectStoreLoadingParams<K>): Promise<K[]> {
    const isLoadingAll = this.dependencies.context.isLoadingAll(namespaces);
    // A namespaced load spanning several namespaces fans out into one
    // paginated stream per namespace — including an all-namespaces load,
    // whose namespaces the caller has already resolved. Only a
    // cluster-scoped resource, or a load of at most one namespace, keeps
    // the single cluster-wide list.
    const loadClusterWide = !this.api.isNamespaced || (isLoadingAll && namespaces.length <= 1);
    const streamCount = loadClusterWide ? 1 : namespaces.length;
    const tracker = this.createLoadProgressTracker(streamCount, this.loadGeneration, onProgress);

    try {
      if (loadClusterWide) {
        if (this.api.isNamespaced) {
          this.loadedNamespaces.set([]);
        }

        const res = this.api.list({ reqInit, pageSize: this.pageSize, onPage: tracker.onPageFor("") }, this.query);

        if (onLoadFailure) {
          try {
            return (await res) ?? [];
          } catch (error) {
            // An aborted request (e.g. the view unmounted before the list
            // arrived) is not a real failure -- let it propagate so the
            // abort-aware catch in `loadAll` can no-op on it instead of
            // surfacing a spurious "Failed to load" error and blanking the list.
            // The signal is checked too, for an error raised after the abort
            // that does not carry the AbortError name.
            if (isAbortError(error) || reqInit?.signal?.aborted) {
              throw error;
            }

            onLoadFailure(new Error(`Failed to load ${this.api.apiBase}`, { cause: error }));

            // reset the store because we are loading all, so that nothing is displayed
            this.items.clear();
            this.selectedItemsIds.clear();

            return [];
          }
        }

        return (await res) ?? [];
      }

      // Keep the all-namespaces marker empty so that subscribe() stays on
      // its single cluster-wide watch; the fan-out below points that
      // watch at the oldest namespace snapshot instead.
      this.loadedNamespaces.set(isLoadingAll ? [] : namespaces);

      // One paginated stream per namespace: every namespace pages in
      // independently and the tracker merges their pages into the
      // progressive snapshots. At most 16 streams are in flight at once,
      // so that a load spanning hundreds of namespaces does not open
      // hundreds of list requests per store.
      const listNamespace = limitAsync(
        async (namespace: string) =>
          this.api.list(
            { namespace, reqInit, pageSize: this.pageSize, onPage: tracker.onPageFor(namespace) },
            this.query,
          ),
        16,
      );
      const results = await Promise.allSettled(namespaces.map((namespace) => listNamespace(namespace)));

      if (isLoadingAll && results.every((result) => result.status === "fulfilled")) {
        // The pages left the cluster-wide ("") resourceVersion at whichever
        // namespace snapshot was parsed last. The cluster-wide watch must
        // start from the oldest snapshot instead: anything newer could
        // skip the events a lagging namespace has yet to tell it about,
        // while older events are replayed and deduplicated by the store.
        const oldestResourceVersion = tracker.oldestResourceVersion();

        if (oldestResourceVersion !== undefined) {
          this.api.setResourceVersion("", oldestResourceVersion);
        }
      }
      const res: K[] = [];

      for (const result of results) {
        switch (result.status) {
          case "fulfilled":
            res.push(...(result.value ?? []));
            break;

          case "rejected":
            // See the cluster-scoped branch above: an aborted request must
            // propagate, not be reported through onLoadFailure.
            if (isAbortError(result.reason) || reqInit?.signal?.aborted) {
              throw result.reason;
            }

            if (onLoadFailure) {
              onLoadFailure(new Error(`Failed to load ${this.api.apiBase}`, { cause: result.reason }));
            } else {
              // if onLoadFailure is not provided then preserve old behaviour
              throw result.reason;
            }
        }
      }

      return res;
    } finally {
      tracker.dispose();
    }
  }

  /**
   * Tracks the pages of one paginated load: publishes snapshots of the
   * items received so far (at most every 250ms, the first page at once) so
   * views fill in while the rest streams in, and keeps `loadingProgress`
   * current once the load is known to span more than one page. A snapshot
   * is never published once a newer load (or a reset) has superseded this
   * one.
   */
  private createLoadProgressTracker(
    streamCount: number,
    generation: number,
    onProgress: KubeObjectStoreLoadingParams<K>["onProgress"],
  ) {
    const publishIntervalMs = 250;
    const accumulated: K[] = [];
    const streams = new Map<
      string,
      { loaded: number; remainingItemCount?: number; pages: number; resourceVersion?: string }
    >();
    let publishTimer: ReturnType<typeof setTimeout> | undefined;
    let lastPublishedAt = 0;

    const publish = () => {
      publishTimer = undefined;

      if (generation !== this.loadGeneration) {
        return;
      }

      lastPublishedAt = Date.now();
      onProgress?.([...accumulated]);
    };

    const schedulePublish = () => {
      if (!onProgress || publishTimer !== undefined) {
        return;
      }

      const sinceLastPublish = Date.now() - lastPublishedAt;

      if (sinceLastPublish >= publishIntervalMs) {
        publish();
      } else {
        publishTimer = setTimeout(publish, publishIntervalMs - sinceLastPublish);
      }
    };

    const reportProgress = () => {
      if (generation !== this.loadGeneration) {
        return;
      }

      const reported = [...streams.values()];
      const moreIsComing = reported.some((stream) => stream.pages > 1 || (stream.remainingItemCount ?? 0) > 0);

      if (!moreIsComing) {
        return;
      }

      const total =
        reported.length === streamCount && reported.every((stream) => stream.remainingItemCount !== undefined)
          ? reported.reduce((sum, stream) => sum + stream.loaded + (stream.remainingItemCount ?? 0), 0)
          : undefined;

      this.loadingProgress = { loaded: accumulated.length, total };
    };

    return {
      onPageFor:
        (stream: string) =>
        (page: KubeApiListPage<K>): void => {
          accumulated.push(...page.items);

          const previous = streams.get(stream);

          streams.set(stream, {
            loaded: page.loaded,
            remainingItemCount: page.remainingItemCount,
            pages: (previous?.pages ?? 0) + 1,
            resourceVersion: page.resourceVersion ?? previous?.resourceVersion,
          });
          reportProgress();
          schedulePublish();
        },
      // The oldest snapshot among the streams, for pointing a cluster-wide
      // watch at a version no namespace snapshot is behind. Only known
      // once every stream reported a (numeric, as etcd versions are)
      // resourceVersion; anything else keeps the version the pages set.
      oldestResourceVersion: (): string | undefined => {
        if (streams.size !== streamCount) {
          return undefined;
        }

        let oldest: { raw: string; value: bigint } | undefined;

        for (const stream of streams.values()) {
          if (stream.resourceVersion === undefined) {
            return undefined;
          }

          let value: bigint;

          try {
            value = BigInt(stream.resourceVersion);
          } catch {
            return undefined;
          }

          if (!oldest || value < oldest.value) {
            oldest = { raw: stream.resourceVersion, value };
          }
        }

        return oldest?.raw;
      },
      dispose: () => {
        if (publishTimer !== undefined) {
          clearTimeout(publishTimer);
          publishTimer = undefined;
        }
      },
    };
  }

  protected filterItemsOnLoad(items: K[]) {
    return items;
  }

  @action
  async loadAll({
    namespaces,
    merge = true,
    reqInit,
    onLoadFailure,
  }: KubeObjectStoreLoadAllParams = {}): Promise<undefined | K[]> {
    namespaces ??= this.dependencies.context.contextNamespaces;
    this.isLoading = true;
    const generation = ++this.loadGeneration;
    const timing = startLoadTiming(this.api.apiBase, generation);

    try {
      const items = await this.loadItems({
        namespaces,
        reqInit,
        onLoadFailure,
        // Show the items received so far while the rest is still streaming
        // in; the merge of the completed load below remains authoritative.
        onProgress: (snapshot) => {
          this.mergeLoadedItems(snapshot, merge, namespaces);
          timing.firstItems();
        },
      });

      this.mergeLoadedItems(items, merge, namespaces);
      timing.firstItems();
      timing.complete();

      this.isLoaded = true;
      this.failedLoading = false;

      return items;
    } catch (error) {
      // A load aborted via its `reqInit.signal` (e.g. the view unmounted before
      // the list arrived, which happens on essentially every view under
      // `React.StrictMode`) is not a real failure. Nothing is waiting on the
      // result, so bail out without logging, resetting, or flipping
      // `failedLoading` — otherwise a late abort from an unmounted view could
      // wipe items freshly loaded by a remounted one.
      if (isAbortError(error) || reqInit?.signal?.aborted) {
        return undefined;
      }

      console.warn("[KubeObjectStore] loadAll failed", this.api.apiBase, error);
      this.resetOnError(error);
      this.failedLoading = true;
    } finally {
      timing.dispose();
      this.isLoading = false;

      if (generation === this.loadGeneration) {
        this.loadingProgress = undefined;
      }
    }

    return undefined;
  }

  @action
  async reloadAll(opts: { force?: boolean; namespaces?: string[]; merge?: boolean } = {}): Promise<undefined | K[]> {
    const { force = false, ...loadingOptions } = opts;

    if (this.isLoading || (this.isLoaded && !force)) {
      return undefined;
    }

    return this.loadAll(loadingOptions);
  }

  /**
   * Merges the result of a load, replacing the stored items of every
   * namespace the load covered. The covered namespaces are the requested
   * ones plus any the loaded items belong to: a cluster-wide load is
   * requested without naming its namespaces, and merging its (cumulative,
   * in the progressive case) items against only the requested list would
   * keep the previously loaded copies next to the fresh ones.
   */
  private mergeLoadedItems(items: K[], merge: boolean, namespaces: string[]): K[] {
    const loadedNamespaces = new Set(namespaces);

    for (const item of items) {
      const namespace = item.getNs();

      if (namespace) {
        loadedNamespaces.add(namespace);
      }
    }

    return this.mergeItems(items, { merge, namespaces: [...loadedNamespaces] });
  }

  @action
  protected mergeItems(
    partialItems: K[],
    { merge = true, updateStore = true, sort = true, filter = true, namespaces }: MergeItemsOptions,
  ): K[] {
    let items = partialItems;

    // update existing items
    if (merge && this.api.isNamespaced) {
      const ns = new Set(namespaces);

      items = [...this.items.filter((item) => !ns.has(item.getNs() as string)), ...partialItems];
    }

    if (filter) items = this.filterItemsOnLoad(items);
    if (sort) items = this.sortItems(items);
    if (updateStore) this.items.replace(items);

    return items;
  }

  @action
  override reset() {
    // Invalidate progressive publishes of a load still in flight: what it
    // already streamed in must not reappear after the reset.
    this.loadGeneration++;
    super.reset();
  }

  protected resetOnError(error: any) {
    if (error) this.reset();
  }

  protected async loadItem(params: { name: string; namespace?: string }): Promise<K | null> {
    return this.api.get(params);
  }

  @action
  async load(params: { name: string; namespace?: string }): Promise<K> {
    const { name, namespace } = params;
    let item: K | null | undefined = this.getByName(name, namespace);

    if (!item) {
      item = await this.loadItem(params);
      assert(item, "Failed to load item from kube");
      const newItems = this.sortItems([...this.items, item]);

      this.items.replace(newItems);
    }

    return item;
  }

  @action
  async loadFromPath(resourcePath: string) {
    const parsedApi = parseKubeApi(resourcePath);

    assert(parsedApi, "resourcePath must be a valid kube api");

    const { namespace, name } = parsedApi;

    assert(name, "name must be part of resourcePath");

    return this.load({ name, namespace });
  }

  protected async createItem(
    params: { name: string; namespace?: string },
    data?: PartialDeep<K, { recurseIntoArrays: true }>,
  ): Promise<K | null> {
    return this.api.create(params, data);
  }

  async create(
    params: { name: string; namespace?: string },
    data?: PartialDeep<K, { recurseIntoArrays: true }>,
  ): Promise<K> {
    const newItem = await this.createItem(params, data);

    assert(newItem, "Failed to create item from kube");
    const items = this.sortItems([...this.items, newItem]);

    this.items.replace(items);

    return newItem;
  }

  private postUpdate(newItem: K): K {
    this.putItem(newItem);

    return newItem;
  }

  async patch(item: K, patch: PartialDeep<K>, strategy: "strategic" | "merge"): Promise<K>;
  async patch(item: K, patch: JsonPatch, strategy?: "json"): Promise<K>;
  async patch(item: K, patch: PartialDeep<K> | JsonPatch, strategy: KubeApiPatchType = "json"): Promise<K> {
    let rawItem: K | null;

    if (strategy === "json") {
      if (!Array.isArray(patch)) {
        throw new Error("For 'json' patch strategy, patch must be a JsonPatch array");
      }
      rawItem = await this.api.patch(
        {
          name: item.getName(),
          namespace: item.getNs(),
        },
        patch as JsonPatch,
        strategy,
      );
    } else {
      if (Array.isArray(patch)) {
        throw new Error("For 'strategic' or 'merge' patch strategy, patch must be a PartialDeep<Object>");
      }
      rawItem = await this.api.patch(
        {
          name: item.getName(),
          namespace: item.getNs(),
        },
        patch as PartialDeep<K>,
        strategy,
      );
    }

    assert(rawItem, `Failed to patch ${item.getScopedName()} of ${item.kind} ${item.apiVersion}`);

    return this.postUpdate(rawItem);
  }

  async update(item: K, data: PartialDeep<K>): Promise<K> {
    const rawItem = await this.api.update(
      {
        name: item.getName(),
        namespace: item.getNs(),
      },
      data,
    );

    assert(rawItem, `Failed to update ${item.getScopedName()} of ${item.kind} ${item.apiVersion}`);

    return this.postUpdate(rawItem);
  }

  async remove(item: K) {
    await this.api.delete({ name: item.getName(), namespace: item.getNs() });
    this.selectedItemsIds.delete(item.getId());
  }

  async removeWithOptions(item: K, deleteOptions?: DeleteOptions) {
    await this.api.delete({ name: item.getName(), namespace: item.getNs(), deleteOptions });
    this.selectedItemsIds.delete(item.getId());
  }

  async removeSelectedItems() {
    await Promise.all(this.selectedItems.map((item) => this.remove(item)));
  }

  async removeItems(items: K[]) {
    await Promise.all(items.map((item) => this.remove(item)));
  }

  // collect items from watch-api events to avoid UI blowing up with huge streams of data
  protected readonly eventsBuffer = observable.array<IKubeWatchEvent<D>>([], { deep: false });

  protected bindWatchEventsUpdater(delay = 1000) {
    reaction(
      () => [...this.eventsBuffer],
      () => this.updateFromEventsBuffer(),
      {
        delay,
      },
    );
  }

  /**
   * Ends every watch of the store and refuses new ones, for a store whose API
   * is gone: a watch of a resource the cluster no longer serves only fails.
   */
  stopWatching(): void {
    this.watchingController.abort();
  }

  subscribe({ onLoadFailure, abortController = new AbortController() }: KubeObjectStoreSubscribeParams = {}): Disposer {
    if (abortController.signal.aborted || this.watchingController.signal.aborted) {
      // The subscriber went away before it subscribed, e.g. a view that
      // unmounted while its list was loading, or the store stopped watching.
      // A watch started now would outlive it.
      return noop;
    }

    // The listener goes when the subscriber's watch ends, so that a store that
    // keeps watching does not collect one for every subscription it had.
    this.watchingController.signal.addEventListener("abort", () => abortController.abort(), {
      once: true,
      signal: abortController.signal,
    });

    if (this.api.isNamespaced) {
      void (async () => {
        try {
          const loadedNamespaces = await Promise.race([
            rejectPromiseBy(abortController.signal),
            waitUntilDefined(() => this.loadedNamespaces.get()),
          ]);

          if (this.dependencies.context.isGlobalWatchEnabled() && loadedNamespaces.length === 0) {
            this.watchNamespace("", abortController, { onLoadFailure });
          } else {
            for (const namespace of loadedNamespaces) {
              this.watchNamespace(namespace, abortController, { onLoadFailure });
            }
          }
        } catch (error) {
          console.error(`[KUBE-OBJECT-STORE]: failed to subscribe to ${this.api.apiBase}`, error);
        }
      })();
    } else {
      this.watchNamespace("", abortController, { onLoadFailure });
    }

    return () => abortController.abort();
  }

  private watchNamespace(namespace: string, abortController: AbortController, opts: KubeObjectStoreSubscribeParams) {
    if (!this.api.getResourceVersion(namespace)) {
      return;
    }

    let timedRetry: NodeJS.Timeout;
    const signal = abortController.signal;

    const startNewWatch = () => {
      // A retry or a reload scheduled before the abort must not start a
      // watch the subscriber can no longer stop.
      if (signal.aborted) return;

      this.api.watch({
        namespace,
        abortController,
        callback,
        query: this.watchQuery,
      });
    };

    const callback: KubeApiWatchCallback<D> = (data, error) => {
      // The fetch of an aborted watch rejects with a DOMException, which is
      // not the `{ type: "aborted" }` shape node-fetch used; without checking
      // the signal the abort would be retried.
      if (signal.aborted || !this.isLoaded || (error as Record<string, unknown> | null)?.type === "aborted") return;

      if (error instanceof Response) {
        if (error.status === 404 || error.status === 401) {
          // api has gone, or credentials are not permitted, let's not retry
          return;
        }

        // not sure what to do, best to retry
        clearTimeout(timedRetry);
        timedRetry = setTimeout(startNewWatch, 5000);
      } else if (error instanceof KubeStatus && error.code === 410) {
        clearTimeout(timedRetry);
        // resourceVersion has gone, let's try to reload
        timedRetry = setTimeout(() => {
          void (
            namespace
              ? this.loadAll({ namespaces: [namespace], reqInit: { signal }, ...opts })
              : this.loadAll({ merge: false, reqInit: { signal }, ...opts })
          ).then(startNewWatch);
        }, 1000);
      } else if (error) {
        // not sure what to do, best to retry
        clearTimeout(timedRetry);
        timedRetry = setTimeout(startNewWatch, 5000);
      }

      if (data) {
        this.eventsBuffer.push(data);
      }
    };

    signal.addEventListener("abort", () => clearTimeout(timedRetry));
    startNewWatch();
  }

  @action
  protected updateFromEventsBuffer() {
    const events = this.eventsBuffer.clear();

    if (!events.length) return;

    // Build once per flush, so direct array writes, reloads and resets cannot
    // leave a stale index. Tombstones keep later indices valid after a delete.
    const items: (K | undefined)[] = this.getItems();
    const indexByUid = new Map(items.map((item, index) => [item!.getId(), index]));
    let changed = false;
    let needsSort = false;

    for (const event of events) {
      if (event.type === "ERROR") continue;

      try {
        const { type, object } = event;
        const uid = object.metadata?.uid;

        if (!uid) {
          this.dependencies.logger.warn("[KUBE-STORE]: watch event did not have defined .metadata.uid, skipping", {
            event,
          });
          continue;
        }

        const index = indexByUid.get(uid);
        const item = index === undefined ? undefined : items[index];

        switch (type) {
          case "ADDED":
          case "MODIFIED": {
            // Kubernetes versions are opaque: equality alone identifies a
            // replay. Do not construct and bind another copy of the same object.
            if (
              item &&
              object.metadata.resourceVersion &&
              item.metadata.resourceVersion === object.metadata.resourceVersion
            ) {
              break;
            }

            const newItem = new this.api.objectConstructor(object);

            if (index === undefined) {
              indexByUid.set(uid, items.length);
              items.push(newItem);
              needsSort = true;
            } else {
              needsSort ||= this.sortKeyChanged(item!, newItem);
              items[index] = newItem;
            }

            changed = true;
            break;
          }
          case "DELETED":
            if (index !== undefined) {
              items[index] = undefined;
              indexByUid.delete(uid);
              changed = true;
            }
            break;
        }
      } catch (error) {
        this.dependencies.logger.error("[KUBE-STORE]: failed to handle event from watch buffer", { error, event });
      }
    }

    if (changed) {
      const retained = items.filter((item): item is K => item !== undefined).slice(-this.bufferSize);

      this.items.replace(needsSort ? this.sortItems(retained) : retained);
    }
  }
}
