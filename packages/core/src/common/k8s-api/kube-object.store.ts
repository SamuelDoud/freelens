/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import assert from "node:assert";
import { parseKubeApi } from "@freelensapp/kube-api";
import { KubeStatus } from "@freelensapp/kube-object";
import { isAbortError, noop, object, rejectPromiseBy, waitUntilDefined } from "@freelensapp/utilities";
import autoBind from "auto-bind";
import { limitAsync } from "es-toolkit";
import { action, computed, observable, observe, reaction } from "mobx";
import { ItemStore } from "../item.store";
import { diffByIdentity, KeyedItemIndex } from "../keyed-item-index";
import { ItemOrder } from "./item-order";

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

/**
 * The maps behind `getById` and `getByPath`, which outlive the snapshots they
 * describe: each is brought to the next snapshot by what changed between the
 * two, so that a flush of a few objects does not read the key of every item of
 * a large store.
 */
class ItemLookupIndexes<K extends KubeObject> {
  readonly byId = new KeyedItemIndex<K>((item) => item.getId());
  readonly byPath = new KeyedItemIndex<K>((item) => item.selfLink);
}

/**
 * Answers `getById` and `getByPath` for one state of a store's items. The
 * first call of each kind scans like `Array.prototype.find`, so a single call
 * costs what it always did; from the second call on, a map is built and every
 * further call is a lookup. The map keeps the first of items that share a
 * key, as `find` does, and stays with the store: a later state of the items
 * brings it up to date from the difference, not from scratch.
 */
class ItemLookups<K extends KubeObject> {
  private idCalls = 0;
  private pathCalls = 0;

  constructor(
    private readonly snapshot: K[],
    private readonly indexes: ItemLookupIndexes<K>,
  ) {}

  getById(id: string): K | undefined {
    const { byId } = this.indexes;

    if (!byId.isBuilt && this.idCalls++ === 0) {
      return this.snapshot.find((item) => item.getId() === id);
    }

    byId.sync(this.snapshot, true);

    return byId.get(id)?.item;
  }

  getByPath(path: string): K | undefined {
    const { byPath } = this.indexes;

    if (!byPath.isBuilt && this.pathCalls++ === 0) {
      return this.snapshot.find((item) => item.selfLink === path);
    }

    byPath.sync(this.snapshot, true);

    return byPath.get(path)?.item;
  }
}

function sameMembers(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;

  for (const member of a) {
    if (!b.has(member)) return false;
  }

  return true;
}

/**
 * `items.filter(keep)`, given `prevResult` as `prevItems.filter(keep)`, where
 * `keep` depends on an item alone. An item that stayed is in the result when
 * it was in the previous one, which the objects tell without reading them;
 * only the items that were added are asked. Undefined when the two lists
 * differ too much to compare that way.
 */
function refilterByDifference<K>(
  prevItems: readonly K[],
  prevResult: readonly K[],
  items: readonly K[],
  keep: (item: K) => boolean,
): K[] | undefined {
  const segments = diffByIdentity(prevItems, items, Math.max(64, items.length >> 2));

  if (!segments) return undefined;

  const result: K[] = [];
  let kept = 0;
  let position = 0;
  let prevPosition = 0;

  const passUnchanged = (to: number) => {
    for (; position < to; position += 1) {
      const item = items[position];

      if (prevResult[kept] === item) {
        result.push(item);
        kept += 1;
      }
    }
  };

  for (const { prevFrom, prevTo, nextFrom, nextTo } of segments) {
    passUnchanged(nextFrom);

    for (prevPosition = prevFrom; prevPosition < prevTo; prevPosition += 1) {
      if (prevResult[kept] === prevItems[prevPosition]) kept += 1;
    }

    for (position = nextFrom; position < nextTo; position += 1) {
      const item = items[position];

      if (keep(item)) result.push(item);
    }
  }

  passUnchanged(items.length);

  return result;
}

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

  /**
   * The namespaces to watch, for a store that was loaded for those and no
   * others in the meantime. Without it, the store watches the namespaces of
   * its latest load.
   */
  namespaces?: string[];
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

  /**
   * The largest page of a paginated list: each page asks for twice as many
   * items as the one before, from `pageSize` up to this many.
   *
   * @default 4000
   */
  maxPageSize?: number;
}

/** How long a load runs before its progress names the namespaces it waits on */
export const slowLoadMs = 10_000;

/**
 * How many items a store has to hold for `release` to free them. A smaller
 * store costs little to keep, and views that read it without subscribing
 * (a details panel, say) go on finding what they found before.
 */
export const releaseFromItemCount = 2000;

/** How many individually loaded objects `release` keeps, the latest ones */
export const releaseKeepsLoadedCount = 500;

/** The most namespaces a load's progress names when it waits on them */
const namedPendingNamespaces = 3;

const parseResourceVersion = (resourceVersion: string | undefined): bigint | undefined => {
  if (!resourceVersion) {
    return undefined;
  }

  try {
    return BigInt(resourceVersion);
  } catch {
    return undefined;
  }
};

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
  public readonly maxPageSize: number;

  private readonly loadedNamespaces = observable.box<string[]>();
  private readonly watchingController = new AbortController();
  // Bumped by every loadAll and reset: a progressive publish scheduled by
  // an older (or reset) load must not put its items back into the store.
  private loadGeneration = 0;
  // Bumped by every reset and release, and not by loads: a load that began
  // before one must not fill the emptied store when it ends, while loads
  // that merely overlap each merge their own namespaces.
  private emptiedCount = 0;
  // The watch events an all-namespaces load caught while it listed, for
  // loadAll to apply once it has merged the load's items.
  private loadReplay: { generation: number; events: IKubeWatchEvent<D>[] } | undefined;
  // The resourceVersion of what the store holds, per namespace ("" for a
  // cluster-wide list): set when a load completes, advanced by the events
  // and bookmarks the store's watches deliver. The API remembers one version
  // per namespace for everyone, which any other list of it moves on, so a
  // watch restarted from that could skip events, deletes among them.
  private readonly heldVersions = new Map<string, string>();
  // Ids of the objects asked for one by one with load(), oldest first. A
  // panel that shows such an object reads it from the store without
  // subscribing, so release() keeps them.
  private readonly individuallyLoaded = new Set<string>();
  // The array `trackItems` listens to and the number of writes it has seen.
  private trackedItems: unknown;
  private itemsWrites = 0;
  // The item of each id in `items`, kept between watch flushes for as long as
  // `itemsWrites` stays what it was when the flush stamped it, and whether
  // `items` is known to be in the order of `sortItems`.
  private flushIndex:
    | { writes: number; byUid: Map<string, K>; sorted: boolean | undefined; duplicates: boolean }
    | undefined;
  // The last list a load stored, see `mergeLoadedItemsIncrementally`.
  private publishedLoad:
    | {
        writes: number;
        published: K[];
        items: K[];
        merge: boolean;
        requested: string[];
        namespaces: Set<string>;
        everyItemHasNamespace: boolean;
      }
    | undefined;

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
    this.maxPageSize = Math.max(this.pageSize, opts?.maxPageSize ?? 4000);

    autoBind(this);
    this.bindWatchEventsUpdater();
  }

  // Kept alive because getById and getByPath are also called outside
  // reactions, where a plain computed would start over on every call. It is
  // replaced whenever `items` changes in any way, so readers re-run as before.
  private readonly itemLookups = computed(() => new ItemLookups<K>(this.items.slice(), this.lookupIndexes), {
    keepAlive: true,
  });
  private readonly lookupIndexes = new ItemLookupIndexes<K>();

  // TODO: Circular dependency: KubeObjectStore -> ClusterFrameContext -> NamespaceStore -> KubeObjectStore
  @computed get contextItems(): K[] {
    const namespaces = new Set(this.dependencies.context.contextNamespaces);
    const items = this.items.slice();
    const isInContext = (item: K) => {
      const itemNamespace = item.getNs();

      return !itemNamespace /* cluster-wide */ || namespaces.has(itemNamespace);
    };
    const last = this.lastContextItems;
    const result =
      (last && sameMembers(last.namespaces, namespaces)
        ? refilterByDifference(last.items, last.result, items, isInContext)
        : undefined) ?? items.filter(isInContext);

    this.lastContextItems = { namespaces, items, result };

    return result;
  }

  // What the last evaluation of `contextItems` saw and gave. The next one starts from it, and reads
  // the namespace of the items that changed instead of every item.
  private lastContextItems: { namespaces: Set<string>; items: K[]; result: K[] } | undefined;

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
      const wanted = new Set(namespaces);

      return this.items.filter((item) => {
        const itemNamespace = item.getNs();

        return itemNamespace != null && wanted.has(itemNamespace);
      });
    }

    if (!strict) {
      return this.items;
    }

    return [];
  }

  getById(id: string): K | undefined {
    return this.itemLookups.get().getById(id);
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
    return this.itemLookups.get().getByPath(path);
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
    // paginated stream per namespace, unless it is an all-namespaces load
    // by a user who may list cluster-wide: that one is a single paginated
    // cluster-wide list. A cluster-scoped resource, or a load of at most
    // one namespace, keeps the single cluster-wide list as well.
    const loadClusterWide =
      !this.api.isNamespaced ||
      (isLoadingAll && (namespaces.length <= 1 || this.dependencies.context.isGlobalListEnabled()));
    const generation = this.loadGeneration;
    const tracker = this.createLoadProgressTracker(loadClusterWide ? [""] : namespaces, generation, onProgress);
    let loadWatch: Awaited<ReturnType<typeof this.startLoadWatch>> | undefined;

    try {
      if (loadClusterWide) {
        // Without the permission to watch cluster-wide, a cluster-wide list
        // is followed by a watch of each namespace.
        const watchNamespaces =
          this.api.isNamespaced && namespaces.length > 1 && !this.dependencies.context.isGlobalWatchEnabled();

        if (this.api.isNamespaced) {
          this.loadedNamespaces.set(watchNamespaces ? namespaces : []);
        }

        const res = this.api.list(
          { reqInit, pageSize: this.pageSize, maxPageSize: this.maxPageSize, onPage: tracker.onPageFor("") },
          this.query,
        );

        if (onLoadFailure) {
          try {
            const listed = (await res) ?? [];

            this.holdVersion("", tracker.streamVersion(""));
            this.holdNamespaceVersions(watchNamespaces, namespaces, tracker.streamVersion(""));

            return listed;
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

        const listed = (await res) ?? [];

        this.holdVersion("", tracker.streamVersion(""));
        this.holdNamespaceVersions(watchNamespaces, namespaces, tracker.streamVersion(""));

        return listed;
      }

      // Keep the all-namespaces marker empty so that subscribe() stays on
      // its single cluster-wide watch; the fan-out below points that
      // watch at the oldest namespace snapshot instead. Without the
      // permission to watch cluster-wide, every namespace is watched.
      const watchedClusterWide = isLoadingAll && this.dependencies.context.isGlobalWatchEnabled();

      this.loadedNamespaces.set(watchedClusterWide ? [] : namespaces);

      // The cluster-wide watch that follows an all-namespaces load starts
      // now, before the namespaces are listed, rather than from the oldest
      // of their snapshots once they all are. On a large cluster that
      // snapshot can be older than the history the API server keeps for
      // watches by the time the last namespace is listed: the watch was
      // refused as too old, and the store listed everything again, over
      // and over. Watched from now, no namespace has to be listed again.
      if (watchedClusterWide) {
        loadWatch = await this.startLoadWatch(reqInit?.signal);
      }

      // One paginated stream per namespace: every namespace pages in
      // independently and the tracker merges their pages into the
      // progressive snapshots. At most 16 streams are in flight at once,
      // so that a load spanning hundreds of namespaces does not open
      // hundreds of list requests per store.
      const listNamespace = limitAsync(
        async (namespace: string) =>
          this.api.list(
            {
              namespace,
              reqInit,
              pageSize: this.pageSize,
              maxPageSize: this.maxPageSize,
              onPage: tracker.onPageFor(namespace),
            },
            this.query,
          ),
        16,
      );
      const results = await Promise.allSettled(namespaces.map((namespace) => listNamespace(namespace)));

      const caught =
        isLoadingAll && results.every((result) => result.status === "fulfilled")
          ? loadWatch?.finish(tracker.namespaceVersion)
          : undefined;

      if (caught) {
        // The watch that follows starts where this one is now.
        this.api.setResourceVersion("", caught.resourceVersion);
        this.holdVersion("", caught.resourceVersion);
        this.loadReplay = { generation, events: caught.events };
      } else if (watchedClusterWide && results.every((result) => result.status === "fulfilled")) {
        // Without a watch started early, the pages left the cluster-wide ("") resourceVersion at whichever
        // namespace snapshot was parsed last. The cluster-wide watch must
        // start from the oldest snapshot instead: anything newer could
        // skip the events a lagging namespace has yet to tell it about,
        // while older events are replayed and deduplicated by the store.
        const oldestResourceVersion = tracker.oldestResourceVersion();

        if (oldestResourceVersion !== undefined) {
          this.api.setResourceVersion("", oldestResourceVersion);
        }

        this.holdVersion("", oldestResourceVersion);
      }

      if (!watchedClusterWide) {
        // Each namespace is watched from its own snapshot.
        results.forEach((result, index) => {
          this.holdVersion(
            namespaces[index],
            result.status === "fulfilled" ? tracker.streamVersion(namespaces[index]) : undefined,
          );
        });
      }

      const res: K[] = [];

      for (const result of results) {
        switch (result.status) {
          case "fulfilled":
            // Not push(...list): a namespace with more than ~120k objects
            // of one kind exceeds the argument limit of a call.
            for (const item of result.value ?? []) {
              res.push(item);
            }
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
      loadWatch?.stop();
      tracker.dispose();
    }
  }

  /**
   * Records the version a completed load leaves a namespace at, or forgets
   * it when the load could not tell, so that the watch falls back to the
   * version the API remembers.
   */
  private holdVersion(namespace: string, version: string | undefined) {
    if (version === undefined) {
      this.heldVersions.delete(namespace);
    } else {
      this.heldVersions.set(namespace, version);
    }
  }

  /** The namespaces a cluster-wide list is followed by a watch of each get the version it left. */
  private holdNamespaceVersions(watched: boolean, namespaces: string[], version: string | undefined) {
    if (watched) {
      for (const namespace of namespaces) {
        this.holdVersion(namespace, version);
      }
    }
  }

  /** Moves a namespace's held version forward to one a watch delivered. */
  private advanceHeldVersion(namespace: string, version: unknown) {
    if (typeof version !== "string" || !version) {
      return;
    }

    const held = parseResourceVersion(this.heldVersions.get(namespace));
    const next = parseResourceVersion(version);

    // Versions are opaque to a client, but a replayed (older) event must not
    // move a numeric one back.
    if (held === undefined || next === undefined || next > held) {
      this.heldVersions.set(namespace, version);
    }
  }

  private watchedVersion(namespace: string): string | undefined {
    return this.heldVersions.get(namespace) ?? this.api.getResourceVersion(namespace);
  }

  /**
   * Watches every namespace from the current resourceVersion while an
   * all-namespaces load lists them. `finish` ends the watch and returns the
   * events newer than the snapshot of their namespace's list, which the
   * listed items do not show yet, and the version the watch had reached.
   * It returns nothing when the watch could not start or failed, and the
   * load then points the watch at the oldest snapshot as before.
   */
  private async startLoadWatch(signal: AbortSignal | null | undefined) {
    try {
      // One item is enough for the version of the whole collection.
      await this.api.list({ reqInit: { signal } }, { ...this.query, limit: 1 });
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) {
        throw error;
      }

      return undefined;
    }

    const startVersion = this.api.getResourceVersion("");
    let latest = parseResourceVersion(startVersion);

    if (startVersion === undefined || latest === undefined) {
      return undefined;
    }

    const controller = new AbortController();
    const abort = () => controller.abort();
    const events: IKubeWatchEvent<D>[] = [];
    let latestRaw = startVersion;
    let failed = false;

    signal?.addEventListener("abort", abort, { once: true });

    const stop = () => {
      controller.abort();
      signal?.removeEventListener("abort", abort);
    };

    this.api.watch({
      namespace: "",
      abortController: controller,
      // No timeout: a watch that the timeout restarts would replay from
      // the start version.
      timeout: 0,
      query: { ...this.watchQuery, resourceVersion: startVersion },
      callback: (event, error) => {
        if (controller.signal.aborted) {
          return;
        }

        if (error || !event || event.type === "ERROR") {
          failed = true;
          stop();

          return;
        }

        const raw = event.object.metadata?.resourceVersion;
        const version = parseResourceVersion(raw);

        // Events come in version order, so an older one is a replay of a
        // restarted stream.
        if (raw === undefined || version === undefined || version <= latest!) {
          return;
        }

        latest = version;
        latestRaw = raw;
        events.push(event);
      },
      onBookmark: (raw) => {
        const version = parseResourceVersion(raw);

        if (version !== undefined && version > latest!) {
          latest = version;
          latestRaw = raw;
        }
      },
    });

    return {
      finish: (namespaceVersion: (namespace: string) => bigint | undefined) => {
        const watched = !failed && !controller.signal.aborted;

        stop();

        if (!watched) {
          return undefined;
        }

        return {
          resourceVersion: latestRaw,
          events: events.filter((event) => {
            if (event.type === "ERROR") {
              return false;
            }

            const listed = namespaceVersion(event.object.metadata?.namespace ?? "");

            // A namespace the load did not list, such as one created
            // meanwhile, takes every event.
            return listed === undefined || parseResourceVersion(event.object.metadata?.resourceVersion)! > listed;
          }),
        };
      },
      stop,
    };
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
    streamNames: string[],
    generation: number,
    onProgress: KubeObjectStoreLoadingParams<K>["onProgress"],
  ) {
    const publishIntervalMs = 250;
    const streamCount = streamNames.length;
    const fannedOut = streamCount > 1;
    let accumulated: K[] = [];
    // What each stream contributed, to take it back when its list starts over.
    const streamItems = new Map<string, K[]>();
    const streams = new Map<
      string,
      { loaded: number; remainingItemCount?: number; pages: number; resourceVersion?: string; done: boolean }
    >();
    let publishTimer: ReturnType<typeof setTimeout> | undefined;
    let lastPublishedAt = 0;
    let slow = false;

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

      // A load of several namespaces reports how many are done, even when
      // each of them fits in one page.
      if (!moreIsComing && !fannedOut) {
        return;
      }

      const total =
        reported.length === streamCount && reported.every((stream) => stream.remainingItemCount !== undefined)
          ? reported.reduce((sum, stream) => sum + stream.loaded + (stream.remainingItemCount ?? 0), 0)
          : undefined;

      if (!fannedOut) {
        this.loadingProgress = { loaded: accumulated.length, total };

        return;
      }

      const done = reported.filter((stream) => stream.done).length;
      const pending = streamCount - done;

      this.loadingProgress = {
        loaded: accumulated.length,
        total,
        namespaces: {
          done,
          total: streamCount,
          waitingOn:
            slow && pending <= namedPendingNamespaces ? streamNames.filter((name) => !streams.get(name)?.done) : [],
        },
      };
    };

    const slowTimer = fannedOut
      ? setTimeout(() => {
          slow = true;
          reportProgress();
        }, slowLoadMs)
      : undefined;

    return {
      onPageFor:
        (stream: string) =>
        (page: KubeApiListPage<K>): void => {
          const previous = streams.get(stream);
          const contributed = streamItems.get(stream) ?? [];

          // A later page always raises `loaded`; a first page of the whole
          // list in its place means the list started over (its continue
          // token expired), and the items it already gave are given again.
          if (previous && previous.loaded > 0 && page.loaded <= previous.loaded && page.items.length === page.loaded) {
            const again = new Set(contributed);

            accumulated = accumulated.filter((item) => !again.has(item));
            contributed.length = 0;
          }

          for (const item of page.items) {
            accumulated.push(item);
            contributed.push(item);
          }

          streamItems.set(stream, contributed);

          streams.set(stream, {
            loaded: page.loaded,
            remainingItemCount: page.remainingItemCount,
            pages: (previous?.pages ?? 0) + 1,
            resourceVersion: page.resourceVersion ?? previous?.resourceVersion,
            done: page.done,
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
      // The snapshot of a stream, as the API server gave it, once its list is done.
      streamVersion: (stream: string): string | undefined => {
        const state = streams.get(stream);

        return state?.done ? state.resourceVersion : undefined;
      },
      // The snapshot a namespace was listed at, once its list is done.
      namespaceVersion: (namespace: string): bigint | undefined => {
        const stream = streams.get(namespace);

        return stream?.done ? parseResourceVersion(stream.resourceVersion) : undefined;
      },
      dispose: () => {
        clearTimeout(slowTimer);

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

  /** What the store keeps of its items after a watch flush; a store that bounds its items overrides it. */
  protected limitWatchedItems(items: K[]): K[] {
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
    const emptiedCount = this.emptiedCount;
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

      if (emptiedCount !== this.emptiedCount) {
        return undefined;
      }

      this.mergeLoadedItems(items, merge, namespaces);

      const replay = this.loadReplay;

      this.loadReplay = undefined;

      if (replay?.generation === generation && replay.events.length) {
        // What changed while the namespaces were listed.
        this.eventsBuffer.push(...replay.events);
        this.updateFromEventsBuffer();
      }

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
    const incremental = this.mergeLoadedItemsIncrementally(items, merge, namespaces);

    if (incremental) {
      return incremental;
    }

    const loadedNamespaces = new Set(namespaces);
    let everyItemHasNamespace = true;

    for (const item of items) {
      const namespace = item.getNs();

      if (namespace) {
        loadedNamespaces.add(namespace);
      } else {
        everyItemHasNamespace = false;
      }
    }

    const merged = this.mergeItems(items, { merge, namespaces: [...loadedNamespaces] });

    // What the next publish of this load can build on: the list just stored
    // and the items it was made of. Only the stock merge is known to make
    // exactly that list from those items.
    this.publishedLoad = this.hasStockMerge()
      ? {
          writes: this.trackItems(),
          published: merged,
          items,
          merge,
          requested: namespaces,
          namespaces: loadedNamespaces,
          everyItemHasNamespace,
        }
      : undefined;

    return merged;
  }

  private hasStockMerge(): boolean {
    const prototype = Object.getPrototypeOf(this);

    return (
      prototype.mergeItems === KubeObjectStore.prototype.mergeItems &&
      prototype.filterItemsOnLoad === KubeObjectStore.prototype.filterItemsOnLoad &&
      prototype.sortItems === (ItemStore.prototype as unknown as { sortItems: unknown }).sortItems
    );
  }

  /**
   * The merge of a load that goes on where the last one of it stopped: `items`
   * are the items of that merge followed by new ones, and nothing wrote to
   * `items` since. The new items are sorted among themselves and merged into
   * the stored list, which gives the list a merge of everything would give
   * (equal items stay in the order the load delivered them), without
   * filtering and sorting what the store already holds.
   */
  private mergeLoadedItemsIncrementally(items: K[], merge: boolean, namespaces: string[]): K[] | undefined {
    const last = this.publishedLoad;

    if (
      !last ||
      last.writes !== this.trackItems() ||
      last.merge !== merge ||
      last.requested !== namespaces ||
      items.length < last.items.length ||
      !this.hasStockMerge()
    ) {
      return undefined;
    }

    for (let index = 0; index < last.items.length; index += 1) {
      if (items[index] !== last.items[index]) {
        return undefined;
      }
    }

    const added = items.slice(last.items.length);

    if (merge && this.api.isNamespaced) {
      // Items of a namespace the load had not covered, or without one, would
      // change which of the stored items are replaced.
      if (!last.everyItemHasNamespace || added.some((item) => !last.namespaces.has(item.getNs() as string))) {
        return undefined;
      }
    }

    const merged = added.length
      ? new ItemOrder<K>(this.sorting.by, this.sorting.order).merge(last.published, added)
      : last.published;

    if (added.length) {
      this.items.replace(merged);
    }

    this.publishedLoad = { ...last, writes: this.itemsWrites, published: merged, items };

    return merged;
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
    this.emptiedCount++;
    this.heldVersions.clear();
    this.individuallyLoaded.clear();
    super.reset();
  }

  private noteIndividuallyLoaded(id: string) {
    // Latest last, and a later list does not make it a listed object
    this.individuallyLoaded.delete(id);
    this.individuallyLoaded.add(id);

    for (const oldest of this.individuallyLoaded) {
      if (this.individuallyLoaded.size <= releaseKeepsLoadedCount) {
        break;
      }

      this.individuallyLoaded.delete(oldest);
    }
  }

  /**
   * Frees the items of a large store that no view subscribes to any longer,
   * so that data nobody looks at stops holding memory. The store is as if
   * never loaded, and loads afresh when a view subscribes again. The
   * objects loaded one by one (the latest few) and the selection of items
   * are kept.
   */
  @action
  release() {
    if (this.items.length < releaseFromItemCount) {
      return;
    }

    this.loadGeneration++;
    this.emptiedCount++;
    this.heldVersions.clear();
    this.eventsBuffer.clear();
    this.items.replace(this.items.filter((item) => this.individuallyLoaded.has(item.getId())));
    this.isLoaded = false;
    this.isLoading = false;
    this.loadingProgress = undefined;
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

    this.noteIndividuallyLoaded(item.getId());

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

  subscribe({
    onLoadFailure,
    abortController = new AbortController(),
    namespaces,
  }: KubeObjectStoreSubscribeParams = {}): Disposer {
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
          const loadedNamespaces =
            namespaces ??
            (await Promise.race([
              rejectPromiseBy(abortController.signal),
              waitUntilDefined(() => this.loadedNamespaces.get()),
            ]));

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
    if (!this.watchedVersion(namespace)) {
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
        // From what this store holds, at every restart too.
        getResourceVersion: () => this.watchedVersion(namespace),
        onBookmark: (version) => {
          if (!signal.aborted) {
            this.advanceHeldVersion(namespace, version);
          }
        },
      });
    };

    const callback: KubeApiWatchCallback<D> = (data, error) => {
      // The fetch of an aborted watch rejects with a DOMException, which is
      // not the `{ type: "aborted" }` shape node-fetch used; without checking
      // the signal the abort would be retried.
      if (signal.aborted || !this.isLoaded || (error as Record<string, unknown> | null)?.type === "aborted") return;

      if (error instanceof Response && error.status !== 410) {
        if (error.status === 404 || error.status === 401) {
          // api has gone, or credentials are not permitted, let's not retry
          return;
        }

        // not sure what to do, best to retry
        clearTimeout(timedRetry);
        timedRetry = setTimeout(startNewWatch, 5000);
      } else if (
        (error instanceof KubeStatus && error.code === 410) ||
        (error instanceof Response && error.status === 410)
      ) {
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

        if (data.type !== "ERROR") {
          this.advanceHeldVersion(namespace, data.object.metadata?.resourceVersion);
        }
      }
    };

    signal.addEventListener("abort", () => clearTimeout(timedRetry));
    startNewWatch();
  }

  @action
  protected updateFromEventsBuffer() {
    const events = this.eventsBuffer.clear();

    if (!events.length) return;

    // A store that bounds or filters its items after a flush sees the whole
    // list, so it takes the path that builds it.
    if (
      this.bufferSize !== Infinity ||
      Object.getPrototypeOf(this).limitWatchedItems !== KubeObjectStore.prototype.limitWatchedItems
    ) {
      this.updateFromEventsByRebuilding(events);

      return;
    }

    this.updateFromEventsByKey(events);
  }

  /**
   * Counts the writes to `items`, whoever makes them, so that what the store
   * keeps about its items (the id index, the last published list) can tell
   * whether it still describes them. Returns the count.
   */
  private trackItems(): number {
    if (this.trackedItems !== this.items) {
      this.trackedItems = this.items;
      this.itemsWrites += 1;
      observe(this.items, () => {
        this.itemsWrites += 1;
      });
    }

    return this.itemsWrites;
  }

  /**
   * Applies the events of a flush to the items by id, where the list is
   * rebuilt only to the extent the events change it: a flush of modified
   * objects replaces them in place, deletions leave out their items, and
   * added or re-keyed items are merged into the sorted list instead of
   * sorting all of it. The result is the list `updateFromEventsByRebuilding`
   * gives for the same events and the same items.
   */
  private updateFromEventsByKey(events: IKubeWatchEvent<D>[]) {
    const stockSort =
      Object.getPrototypeOf(this).sortItems === (ItemStore.prototype as unknown as { sortItems: unknown }).sortItems;
    const writes = this.trackItems();
    let index = this.flushIndex;

    if (!index || index.writes !== writes) {
      const byUid = new Map<string, K>();
      let duplicates = false;

      for (const item of this.items.slice()) {
        const size = byUid.size;

        byUid.set(item.getId(), item);
        duplicates ||= byUid.size === size;
      }

      index = { writes, byUid, sorted: undefined, duplicates };
      this.flushIndex = index;
    }

    if (index.duplicates) {
      // Which of two items with one id an event meets is what the rebuilding
      // path decides.
      this.updateFromEventsByRebuilding(events);

      return;
    }

    const { byUid } = index;
    // What the events did. Items the list held: the item an event found, and
    // what became of it (a newer item, or undefined once deleted). Items they
    // added: in the order of the events, with undefined where one was deleted.
    const found = new Map<string, { original: K; current: K | undefined }>();
    const added: (K | undefined)[] = [];
    const addedAt = new Map<string, number>();
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

        const addedIndex = addedAt.get(uid);
        let entry = addedIndex === undefined ? found.get(uid) : undefined;
        let item: K | undefined;

        if (addedIndex !== undefined) {
          item = added[addedIndex];
        } else if (entry) {
          item = entry.current;
        } else {
          item = byUid.get(uid);

          if (item) {
            entry = { original: item, current: item };
          }
        }

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

            if (item === undefined) {
              addedAt.set(uid, added.length);
              added.push(newItem);
              needsSort = true;
            } else {
              needsSort ||= this.sortKeyChanged(item, newItem);

              if (addedIndex !== undefined) {
                added[addedIndex] = newItem;
              } else {
                entry!.current = newItem;
                found.set(uid, entry!);
              }
            }

            changed = true;
            break;
          }
          case "DELETED":
            if (item !== undefined) {
              if (addedIndex !== undefined) {
                added[addedIndex] = undefined;
                addedAt.delete(uid);
              } else {
                entry!.current = undefined;
                found.set(uid, entry!);
              }

              changed = true;
            }
            break;
        }
      } catch (error) {
        this.dependencies.logger.error("[KUBE-STORE]: failed to handle event from watch buffer", { error, event });
      }
    }

    if (!changed) return;

    const live = added.filter((item): item is K => item !== undefined);
    // The items to find in the list: what each of them became, null for deleted.
    const touched = new Map<K, K | null>();
    let deletions = 0;

    for (const { original, current } of found.values()) {
      if (current !== original) {
        touched.set(original, current ?? null);
        deletions += current ? 0 : 1;
      }
    }

    // The index is back once the list is written: a failure in between leaves
    // none, not one that no longer describes the list.
    this.flushIndex = undefined;

    for (const [uid, { current }] of found) {
      if (current) {
        byUid.set(uid, current);
      } else {
        byUid.delete(uid);
      }
    }

    for (const item of live) {
      byUid.set(item.getId(), item);
    }

    const base: K[] = this.items.slice();
    const positions: number[] = [];

    for (let position = 0; position < base.length && positions.length < touched.size; position += 1) {
      if (touched.has(base[position])) {
        positions.push(position);
      }
    }

    if (deletions === 0 && live.length === 0 && !needsSort) {
      // Objects replaced by newer versions that sort where they did.
      for (const position of positions) {
        this.items[position] = touched.get(base[position])!;
      }

      index.writes = this.itemsWrites;
      this.flushIndex = index;

      return;
    }

    // `base` as the rebuilding path sees it before it sorts: replaced items
    // in place, deleted ones gone, added ones last. `ranks` tell where each of
    // the items that stay was in `base`.
    const order = new ItemOrder<K>(this.sorting.by, this.sorting.order);
    const merging = needsSort && stockSort && (index.sorted ??= order.isSorted(base));
    const ranks = new Int32Array(base.length);
    const kept: K[] = [];
    const moved: { item: K; rank: number }[] = [];
    const keep = (from: number, to: number) => {
      for (let position = from; position < to; position += 1) {
        ranks[kept.length] = position;
        kept.push(base[position]);
      }
    };
    let from = 0;

    for (const position of positions) {
      keep(from, position);
      from = position + 1;

      const item = touched.get(base[position]);

      if (item === null || item === undefined) continue;

      if (merging && this.sortKeyChanged(base[position], item)) {
        moved.push({ item, rank: position });
      } else {
        ranks[kept.length] = position;
        kept.push(item);
      }
    }

    keep(from, base.length);

    let next: K[];

    if (!needsSort) {
      next = kept;
    } else if (merging) {
      live.forEach((item, at) => moved.push({ item, rank: base.length + at }));
      next = moved.length ? order.mergeRanked(kept, ranks, moved) : kept;
    } else {
      next = this.sortItems([...kept, ...live]);
    }

    if (next.length !== base.length || next.some((item, position) => item !== base[position])) {
      this.items.replace(next);
    }

    if (needsSort) {
      index.sorted = merging || (stockSort ? true : undefined);
    }

    index.writes = this.itemsWrites;
    this.flushIndex = index;
  }

  /**
   * The flush as it was before it worked by id: the list is copied, the events
   * applied to the copy, and the whole of it replaced, sorted when an event
   * added an item or changed a sort key. Stores that bound their list need it.
   */
  private updateFromEventsByRebuilding(events: IKubeWatchEvent<D>[]) {
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
      const retained = this.limitWatchedItems(
        items.filter((item): item is K => item !== undefined).slice(-this.bufferSize),
      );

      this.items.replace(needsSort ? this.sortItems(retained) : retained);
    }
  }
}
