/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { parseKubeApi } from "@freelensapp/kube-api";
import { KubeStatus } from "@freelensapp/kube-object";
import { object, rejectPromiseBy, waitUntilDefined } from "@freelensapp/utilities";

/**
 * Global concurrency limiter for Kubernetes API list requests.
 * Prevents thundering herd on cluster connect when 40+ stores
 * fire loadAll() simultaneously.
 */
const MAX_CONCURRENT_LIST_REQUESTS = 8;
let activeListRequests = 0;
const listRequestQueue: (() => void)[] = [];

function acquireListSlot(): Promise<void> {
  if (activeListRequests < MAX_CONCURRENT_LIST_REQUESTS) {
    activeListRequests++;

    return Promise.resolve();
  }

  return new Promise((resolve) => {
    listRequestQueue.push(() => {
      activeListRequests++;
      resolve();
    });
  });
}

function releaseListSlot(): void {
  activeListRequests--;
  const next = listRequestQueue.shift();

  if (next) next();
}

import assert from "assert";
import autoBind from "auto-bind";
import { action, computed, makeObservable, observable, reaction } from "mobx";
import { ItemStore } from "../item.store";

import type {
  DeleteOptions,
  IKubeWatchEvent,
  KubeApi,
  KubeApiPatchType,
  KubeApiQueryParams,
  KubeApiWatchCallback,
} from "@freelensapp/kube-api";
import type { KubeJsonApiDataFor, KubeObject } from "@freelensapp/kube-object";
import type { Logger } from "@freelensapp/logger";
import type { RequestInit } from "@freelensapp/node-fetch";
import type { Disposer } from "@freelensapp/utilities";

import type { Patch } from "rfc6902";
import type { PartialDeep } from "type-fest";

import type { ClusterContext } from "../../renderer/cluster-frame-context/cluster-frame-context";

export type OnLoadFailure = (error: unknown) => void;

export interface KubeObjectStoreLoadingParams {
  namespaces: string[];
  reqInit?: RequestInit;

  /**
   * A function that is called when listing fails. If set then blocks errors
   * being rejected with
   */
  onLoadFailure?: OnLoadFailure;
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
  listPageSize?: number;
}

export type KubeApiDataFrom<K extends KubeObject, A> =
  A extends KubeApi<K, infer D> ? (D extends KubeJsonApiDataFor<K> ? D : never) : never;

export type JsonPatch = Patch;

export interface KubeObjectStoreDependencies {
  readonly context: ClusterContext;
  readonly logger: Logger;
}

export class KubeObjectStore<
  K extends KubeObject = KubeObject,
  A extends KubeApi<K, D> = KubeApi<K, KubeJsonApiDataFor<K>>,
  D extends KubeJsonApiDataFor<K> = KubeApiDataFrom<K, A>,
> extends ItemStore<K> {
  /** Global default page size for paginated API list calls. Set from user preferences. */
  static defaultListPageSize: number | undefined;

  public readonly limit: number | undefined;
  public readonly bufferSize: number;
  public readonly listPageSize: number | undefined;

  private readonly loadedNamespaces = observable.box<string[]>();

  constructor(
    protected readonly dependencies: KubeObjectStoreDependencies,
    public readonly api: A,
    opts?: KubeObjectStoreOptions,
  ) {
    super();
    this.limit = opts?.limit;
    this.bufferSize = opts?.bufferSize ?? Infinity;
    this.listPageSize = opts?.listPageSize;

    makeObservable(this);
    autoBind(this);
    this.bindWatchEventsUpdater();
  }

  // TODO: Circular dependency: KubeObjectStore -> ClusterFrameContext -> NamespaceStore -> KubeObjectStore
  @computed get contextItems(): K[] {
    const namespaces = new Set(this.dependencies.context.contextNamespaces);

    return this.items.filter((item) => {
      const itemNamespace = item.getNs();

      return !itemNamespace /* cluster-wide */ || namespaces.has(itemNamespace);
    });
  }

  getTotalCount(): number {
    return this.contextItems.length;
  }

  get query(): KubeApiQueryParams {
    const { limit } = this;

    if (!limit) {
      return {};
    }

    return { limit };
  }

  getAllByNs(namespace: string | string[], strict = false): K[] {
    const namespaces = new Set([namespace].flat());

    if (namespaces.size) {
      return this.items.filter((item) => namespaces.has(item.getNs() as string));
    }

    if (!strict) {
      return this.items;
    }

    return [];
  }

  @computed private get itemByIdIndex(): Map<string, K> {
    const map = new Map<string, K>();

    for (const item of this.items) {
      map.set(item.getId(), item);
    }

    return map;
  }

  @computed private get itemBySelfLinkIndex(): Map<string, K> {
    const map = new Map<string, K>();

    for (const item of this.items) {
      map.set(item.selfLink, item);
    }

    return map;
  }

  getById(id: string): K | undefined {
    return this.itemByIdIndex.get(id);
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
        ownerRefs.some(
          (ref) => (!apiVersion || ref.apiVersion === apiVersion) && ref.kind === kind && ref.name === name,
        )
      );
    });
  }

  getByPath(path: string): K | undefined {
    return this.itemBySelfLinkIndex.get(path);
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

  protected async loadItems({ namespaces, reqInit, onLoadFailure }: KubeObjectStoreLoadingParams): Promise<K[]> {
    const isLoadingAll = this.dependencies.context.isLoadingAll(namespaces);
    const effectivePageSize = this.listPageSize ?? KubeObjectStore.defaultListPageSize;

    if (!this.api.isNamespaced || isLoadingAll) {
      if (this.api.isNamespaced) {
        this.loadedNamespaces.set([]);
      }

      // Progressively render items as pages arrive from the paginated API.
      // Throttle UI updates to every 10 pages to avoid hammering MobX with
      // 100+ sort+replace cascades on large clusters.
      // Renders are scheduled asynchronously via setTimeout(0) so they don't
      // block the next page fetch.
      let pageCount = 0;
      let loadGeneration = 0;
      // Show first page immediately so users see results fast,
      // then throttle to avoid hammering MobX on subsequent pages.
      // Scale the interval with page size: larger pages = fewer renders needed.
      const pageSize = effectivePageSize ?? 500;
      const progressInterval = Math.max(1, Math.ceil(5000 / pageSize));
      const onPage = (items: K[]) => {
        pageCount++;

        // Always render the first page so something appears immediately
        if (pageCount === 1 || pageCount % progressInterval === 0) {
          const snapshot = items.slice();

          setTimeout(
            action(() => {
              this.items.replace(this.sortItems(this.filterItemsOnLoad(snapshot)));
            }),
            0,
          );
        }
      };

      const res = this.api.list({ reqInit, pageSize: effectivePageSize }, this.query, onPage);

      if (onLoadFailure) {
        try {
          return (await res) ?? [];
        } catch (error) {
          onLoadFailure(new Error(`Failed to load ${this.api.apiBase}`, { cause: error }));

          // reset the store because we are loading all, so that nothing is displayed
          this.items.clear();
          this.selectedItemsIds.clear();

          return [];
        }
      }

      return (await res) ?? [];
    }

    this.loadedNamespaces.set(namespaces);

    const results = await Promise.allSettled(
      namespaces.map((namespace) => this.api.list({ namespace, reqInit, pageSize: effectivePageSize }, this.query)),
    );
    const res: K[] = [];

    for (const result of results) {
      switch (result.status) {
        case "fulfilled":
          res.push(...(result.value ?? []));
          break;

        case "rejected":
          if (onLoadFailure) {
            onLoadFailure(new Error(`Failed to load ${this.api.apiBase}`, { cause: result.reason }));
          } else {
            // if onLoadFailure is not provided then preserve old behaviour
            throw result.reason;
          }
      }
    }

    return res;
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
    this.failedLoading = false;

    await acquireListSlot();

    try {
      // Check if aborted while waiting in the queue
      if (reqInit?.signal?.aborted) {
        throw new DOMException("The operation was aborted", "AbortError");
      }

      const isLoadingAll = this.dependencies.context.isLoadingAll(namespaces);
      const items = await this.loadItems({ namespaces, reqInit, onLoadFailure });

      // When loading all (progressive rendering path), onPage already
      // sorted, filtered, and replaced items incrementally — skip the
      // expensive redundant sort/filter in mergeItems.
      const skipSort = !this.api.isNamespaced || isLoadingAll;

      this.mergeItems(items, { merge, namespaces, sort: !skipSort, filter: !skipSort });

      this.isLoaded = true;
      this.failedLoading = false;

      return items;
    } catch (error) {
      // Aborts are intentional cancellations (e.g. namespace switch) — don't
      // reset the store or mark as failed, since a new load is already in flight.
      if (!this.isAbortError(error)) {
        console.warn("[KubeObjectStore] loadAll failed", this.api.apiBase, error);
        this.resetOnError(error);
        this.failedLoading = true;
      }
    } finally {
      releaseListSlot();
      this.isLoading = false;
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

  @action
  protected mergeItems(
    partialItems: K[],
    { merge = true, updateStore = true, sort = true, filter = true, namespaces }: MergeItemsOptions,
  ): K[] {
    let items = partialItems;

    // update existing items
    if (merge && this.api.isNamespaced) {
      const ns = new Set(namespaces);

      items = this.items.filter((item) => !ns.has(item.getNs() as string)).concat(partialItems);
    }

    if (filter) items = this.filterItemsOnLoad(items);
    if (sort) items = this.sortItems(items);
    if (updateStore) this.items.replace(items);

    return items;
  }

  private isAbortError(error: unknown): boolean {
    return (error instanceof DOMException || error instanceof Error) && (error as Error).name === "AbortError";
  }

  protected resetOnError(error: any) {
    if (error && !this.isAbortError(error)) this.reset();
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
    const existing = this.itemByIdIndex.get(newItem.getId());

    if (existing) {
      const index = this.items.indexOf(existing);

      if (index >= 0) {
        this.items[index] = newItem;
      } else {
        this.items.push(newItem);
      }
    } else {
      this.items.push(newItem);
    }

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
      () => this.eventsBuffer.length,
      () => this.updateFromEventsBuffer(),
      {
        delay,
      },
    );
  }

  subscribe({ onLoadFailure, abortController = new AbortController() }: KubeObjectStoreSubscribeParams = {}): Disposer {
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
    const startNewWatch = () =>
      this.api.watch({
        namespace,
        abortController,
        callback,
      });

    const signal = abortController.signal;

    const callback: KubeApiWatchCallback<D> = (data, error) => {
      if (!this.isLoaded || (error as Record<string, unknown> | null)?.type === "aborted") return;

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
    // Build an index for O(1) lookup instead of O(n) findIndex per event.
    const indexById = new Map<string, number>();

    for (let i = 0; i < this.items.length; i++) {
      indexById.set(this.items[i].getId(), i);
    }

    // Mutate this.items directly instead of calling items.replace() so that
    // MobX only notifies observers of the specific indices that changed,
    // avoiding a full cascade re-render of every visible row.
    // Collect deletions and apply them in reverse order to preserve indices.
    const deletionIndices: number[] = [];

    for (const event of this.eventsBuffer.clear()) {
      if (event.type === "ERROR") {
        continue;
      }

      try {
        const { type, object } = event;

        if (!object.metadata?.uid) {
          this.dependencies.logger.warn("[KUBE-STORE]: watch event did not have defined .metadata.uid, skipping", {
            event,
          });
          continue;
        }

        const uid = object.metadata.uid;
        const index = indexById.get(uid) ?? -1;

        switch (type) {
          case "ADDED":
          case "MODIFIED": {
            // Skip reconstruction if the resource version hasn't changed
            if (index >= 0 && this.items[index].getResourceVersion() === object.metadata.resourceVersion) {
              break;
            }

            const newItem = new this.api.objectConstructor(object);

            if (index < 0) {
              const newIndex = this.items.length;

              this.items.push(newItem);
              indexById.set(uid, newIndex);
            } else {
              this.items[index] = newItem;
            }

            break;
          }
          case "DELETED":
            if (index >= 0) {
              deletionIndices.push(index);
              indexById.delete(uid);
            }
            break;
        }
      } catch (error) {
        this.dependencies.logger.error("[KUBE-STORE]: failed to handle event from watch buffer", { error, event });
      }
    }

    // Apply deletions in reverse index order so earlier indices stay valid
    if (deletionIndices.length > 0) {
      deletionIndices.sort((a, b) => b - a);

      for (const index of deletionIndices) {
        this.items.splice(index, 1);
      }
    }

    // Trim to buffer size if needed
    if (this.items.length > this.bufferSize) {
      this.items.splice(0, this.items.length - this.bufferSize);
    }
  }
}
