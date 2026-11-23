/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { action, computed, observable } from "mobx";
import { rowsServiceUnavailableStatus } from "../../common/api-rows-prefix";
import { PodRowItem, podRowCell } from "./pod-row-item";

import type { PodRowCells } from "./pod-row-item";

/** What `/rows` of the rows service answers. */
export interface PodRowsSnapshot {
  seq: number;
  cols: string[];
  rows: PodRowCells[];
}

/**
 * One batch of changes, a line of `/rows/watch`: `a` whole rows added (or
 * replaced), `c` changed cells as `[id, column, value, column, value, ...]`,
 * `d` ids deleted.
 */
export interface PodRowsDelta {
  s: number;
  a: PodRowCells[];
  c: (number | unknown)[][];
  d: number[];
}

export interface PodRowStoreDependencies {
  fetch: typeof fetch;
  /** Where the rows service answers, as a path of the cluster frame's origin. */
  readonly baseUrl: string;
  /** The namespaces the user has selected. */
  getContextNamespaces: () => readonly string[];
  /** Whether pods that ran to completion are left out, as the cluster's preference says. */
  hideCompletedPods: () => boolean;
  /**
   * How long batches gather before the table sees them. The default is the delay
   * with which the kube object stores apply their watch events, so the rows list
   * sorts and renders as often as the list of full pods, not on every batch.
   */
  readonly publishDelayMs?: number;
}

const defaultPublishDelayMs = 1000;

const retryDelaysMs = [500, 1000, 2000, 5000];

/** The rows service cannot serve this cluster: the list uses full pods instead. */
class RowsServiceUnavailable extends Error {}

/** A batch is missing from the stream, so the rows are no longer known to be right. */
class RowsStreamGap extends Error {}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);

    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });

/**
 * The rows of the Pods list: a Map by id, and an array of the same items for
 * the table, which is made anew only when a batch changed something. It
 * implements what the list layout asks of a store, and keeps no `Pod`.
 */
export class PodRowStore {
  private readonly rows = new Map<number, PodRowItem>();

  private readonly itemsBox = observable.box<PodRowItem[]>([], { deep: false });
  @observable accessor isLoaded = false;
  @observable accessor failedLoading = false;
  /**
   * The rows service answered that it cannot serve this cluster (the option is off,
   * its binary is missing, or the user may not list pods in every namespace). The
   * Pods list then shows the list of full pods, until `resetUnavailable`.
   */
  @observable accessor unavailable = false;
  /** The sequence number of the last batch applied, `0` before the first. */
  seq = 0;

  private abort?: AbortController;
  private users = 0;

  constructor(private readonly dependencies: PodRowStoreDependencies) {}

  /** Replaced, never changed in place, so the table sees a new array for each batch. */
  get items(): PodRowItem[] {
    return this.itemsBox.get();
  }

  get size() {
    return this.rows.size;
  }

  getById(id: number) {
    return this.rows.get(id);
  }

  /** The item a `/api/v1/namespaces/<ns>/pods/<name>` path names. */
  getByPath(path: string | undefined) {
    const match = path && /^\/api\/v1\/namespaces\/([^/]+)\/pods\/([^/]+)$/.exec(path);

    if (!match) {
      return undefined;
    }

    for (const item of this.rows.values()) {
      if (item.getName() === match[2] && item.getNs() === match[1]) {
        return item;
      }
    }

    return undefined;
  }

  /** The items in the namespaces the user selected. */
  @computed get contextItems(): PodRowItem[] {
    const namespaces = new Set(this.dependencies.getContextNamespaces());
    const hideCompleted = this.dependencies.hideCompletedPods();

    return this.items.filter((item) => namespaces.has(item.getNs()) && !(hideCompleted && item.status === "Succeeded"));
  }

  readonly getContextItems = () => this.contextItems;

  /**
   * How many of the items have each status of `Pod.getStatus()`, as
   * `PodStore.getStatuses` counts them for the Workloads overview: the key order is
   * the order of the pie chart segments, descending by status name.
   */
  getStatuses(items: readonly PodRowItem[]): Record<string, number> {
    const counts = new Map<string, number>();

    for (const item of items) {
      counts.set(item.overviewStatus, (counts.get(item.overviewStatus) ?? 0) + 1);
    }

    const result: Record<string, number> = {};

    for (const status of [...counts.keys()].sort().reverse()) {
      result[status] = counts.get(status) as number;
    }

    return result;
  }

  // What the list layout asks of its store
  getTotalCount = () => this.contextItems.length;
  isSelected = () => false;
  toggleSelection = () => {};
  isSelectedAll = () => false;
  toggleSelectionAll = () => {};
  pickOnlySelected = (): PodRowItem[] => [];
  removeSelectedItems = async () => {};

  /** Replaces every row, as a load does. */
  @action replaceAll(snapshot: PodRowsSnapshot) {
    this.rows.clear();

    for (const cells of snapshot.rows) {
      this.rows.set(cells[podRowCell.id], new PodRowItem(cells));
    }

    this.seq = snapshot.seq;
    this.isLoaded = true;
    this.failedLoading = false;
    this.cancelPublish();
    this.publish();
  }

  /**
   * Applies one batch. A change to a row that is not known is dropped: the
   * row was deleted, or the batch is older than the snapshot.
   */
  @action applyDelta(delta: PodRowsDelta) {
    let changed = false;

    for (const cells of delta.a) {
      this.rows.set(cells[podRowCell.id], new PodRowItem(cells));
      changed = true;
    }

    for (const [id, ...pairs] of delta.c) {
      const existing = this.rows.get(id as number);

      if (!existing) {
        continue;
      }

      const cells = [...existing.cells] as unknown as unknown[];

      for (let index = 0; index < pairs.length; index += 2) {
        cells[pairs[index] as number] = pairs[index + 1];
      }

      this.rows.set(id as number, new PodRowItem(cells as unknown as PodRowCells));
      changed = true;
    }

    for (const id of delta.d) {
      changed = this.rows.delete(id) || changed;
    }

    this.seq = Math.max(this.seq, delta.s);

    if (changed) {
      this.schedulePublish();
    }
  }

  private publishTimer?: ReturnType<typeof setTimeout>;

  /** Publishes once the batches of the publish delay have gathered, or at once without a delay. */
  private schedulePublish() {
    const delay = this.dependencies.publishDelayMs ?? defaultPublishDelayMs;

    if (delay <= 0) {
      this.publish();
    } else {
      this.publishTimer ??= setTimeout(() => {
        this.publishTimer = undefined;
        this.publish();
      }, delay);
    }
  }

  private cancelPublish() {
    clearTimeout(this.publishTimer);
    this.publishTimer = undefined;
  }

  @action protected publish() {
    this.itemsBox.set(Array.from(this.rows.values()));
  }

  /**
   * Starts loading and following the rows for a list that is shown, and
   * returns what stops it. Lists that are shown together share one stream.
   */
  start(): () => void {
    this.users += 1;

    if (this.users === 1) {
      this.abort = new AbortController();
      void this.run(this.abort.signal);
    }

    return () => {
      this.users -= 1;

      if (this.users === 0) {
        this.abort?.abort();
        this.abort = undefined;
        this.cancelPublish();
      }
    };
  }

  private async run(signal: AbortSignal) {
    let attempt = 0;

    while (!signal.aborted) {
      try {
        await this.sync(signal, () => {
          attempt = 0;
        });
      } catch (error) {
        if (signal.aborted) {
          return;
        }

        if (error instanceof RowsServiceUnavailable) {
          this.markUnavailable();

          return;
        }

        console.warn("[PodRowStore] the rows stream failed", error);
        this.markFailed();
      }

      if (signal.aborted) {
        return;
      }

      await sleep(retryDelaysMs[Math.min(attempt, retryDelaysMs.length - 1)], signal);
      attempt += 1;
    }
  }

  private markUnavailable = action(() => {
    this.unavailable = true;
  });

  /** Lets the list try the rows service again, after the option was turned off and on. */
  @action resetUnavailable() {
    this.unavailable = false;
  }

  /** Applies the next batch, or fails the stream when one is missing, so that it is loaded again. */
  private applyNext(delta: PodRowsDelta) {
    if (delta.s <= this.seq) {
      return;
    }

    if (delta.s !== this.seq + 1) {
      throw new RowsStreamGap(`batch ${delta.s} follows batch ${this.seq}`);
    }

    this.applyDelta(delta);
  }

  private markFailed = action(() => {
    // Rows already shown stay: only a list that never loaded is a failure
    this.failedLoading = !this.isLoaded;
  });

  /**
   * Follows the deltas from before the snapshot is asked for, holds the ones
   * that arrive until it is there, and drops those it already has: a row is
   * neither missed nor applied twice. Returns when the stream ends.
   */
  private async sync(parentSignal: AbortSignal, onLoaded: () => void) {
    const { fetch, baseUrl } = this.dependencies;
    // Ends the stream whichever way this sync ends
    const own = new AbortController();
    const signal = own.signal;
    const stop = () => own.abort();

    parentSignal.addEventListener("abort", stop, { once: true });

    try {
      const watch = await fetch(`${baseUrl}/rows/watch`, { signal });

      if (watch.status === rowsServiceUnavailableStatus) {
        throw new RowsServiceUnavailable(await watch.text());
      }

      if (!watch.ok || !watch.body) {
        throw new Error(`/rows/watch answered ${watch.status}`);
      }

      let loadedSeq: number | undefined;
      const held: PodRowsDelta[] = [];
      const onDelta = (delta: PodRowsDelta) => {
        if (loadedSeq === undefined) {
          held.push(delta);
        } else {
          this.applyNext(delta);
        }
      };
      const streaming = readNdjson<PodRowsDelta>(watch.body, onDelta);

      // Awaited at the end; a failure before then must not go unhandled
      streaming.catch(() => {});

      const snapshotResponse = await fetch(`${baseUrl}/rows`, { signal });

      if (snapshotResponse.status === rowsServiceUnavailableStatus) {
        throw new RowsServiceUnavailable(await snapshotResponse.text());
      }

      if (!snapshotResponse.ok) {
        throw new Error(`/rows answered ${snapshotResponse.status}`);
      }

      const snapshot = (await snapshotResponse.json()) as PodRowsSnapshot;

      this.replaceAll(snapshot);
      loadedSeq = snapshot.seq;

      for (const delta of held.splice(0)) {
        this.applyNext(delta);
      }

      onLoaded();
      await streaming;
    } finally {
      parentSignal.removeEventListener("abort", stop);
      stop();
    }
  }
}

/** Reads a body of lines of JSON, calling back for each as it completes. */
export async function readNdjson<T>(body: ReadableStream<Uint8Array>, onItem: (item: T) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = "";

  for (;;) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    pending += decoder.decode(value, { stream: true });

    let newline = pending.indexOf("\n");

    while (newline >= 0) {
      const line = pending.slice(0, newline);

      pending = pending.slice(newline + 1);

      if (line.trim()) {
        onItem(JSON.parse(line) as T);
      }

      newline = pending.indexOf("\n");
    }
  }
}
