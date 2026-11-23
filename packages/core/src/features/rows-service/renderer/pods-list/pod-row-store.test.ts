/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it, vi } from "vitest";
import { podRowColumns } from "./pod-row-columns";
import { PodRowItem } from "./pod-row-item";
import { PodRowStore } from "./pod-row-store";

import type { PodRowCells } from "./pod-row-item";

const row = (
  id: number,
  name: string,
  namespace = "default",
  overrides: Partial<{ restarts: number; created: number; status: string; cpuRequest: number | null }> = {},
): PodRowCells => [
  id,
  name,
  namespace,
  [[`${name}-c`, "running", "running, ready"]],
  overrides.restarts ?? 0,
  [["ReplicaSet", `${name}-rs`]],
  "node-1",
  "Burstable",
  overrides.created ?? 1_700_000_000_000,
  overrides.status ?? "Running",
  overrides.cpuRequest ?? null,
  null,
  null,
  null,
];

const createStore = (namespaces: string[] = ["default", "other"], hideCompleted = false) =>
  new PodRowStore({
    fetch: () => Promise.reject(new Error("not used")),
    baseUrl: "/api-rows",
    getContextNamespaces: () => namespaces,
    hideCompletedPods: () => hideCompleted,
  });

describe("PodRowStore", () => {
  it("replaces every row on a snapshot, and publishes a new array", () => {
    const store = createStore();

    store.replaceAll({ seq: 3, cols: [], rows: [row(1, "a"), row(2, "b")] });

    const first = store.items;

    expect(first.map((item) => item.getName())).toEqual(["a", "b"]);
    expect(store.isLoaded).toBe(true);
    expect(store.seq).toBe(3);

    store.replaceAll({ seq: 4, cols: [], rows: [row(3, "c")] });

    expect(store.items.map((item) => item.getName())).toEqual(["c"]);
    expect(store.items).not.toBe(first);
  });

  it("applies adds, changes and deletes of a batch", () => {
    const store = createStore();

    store.replaceAll({ seq: 1, cols: [], rows: [row(1, "a"), row(2, "b")] });
    const untouched = store.getById(2);
    const changedBefore = store.getById(1);

    store.applyDelta({
      s: 2,
      a: [row(3, "c")],
      // restarts (4) and status (9) of row 1
      c: [[1, 4, 7, 9, "CrashLoopBackOff"]],
      d: [],
    });

    expect(store.items.map((item) => item.getName())).toEqual(["a", "b", "c"]);
    expect(store.getById(1)).not.toBe(changedBefore);
    expect(store.getById(1)?.restarts).toBe(7);
    expect(store.getById(1)?.status).toBe("CrashLoopBackOff");
    expect(store.getById(2)).toBe(untouched);

    store.applyDelta({ s: 3, a: [], c: [], d: [2] });

    expect(store.items.map((item) => item.getName())).toEqual(["a", "c"]);
    expect(store.seq).toBe(3);
  });

  it("drops a change to a row it does not know, and keeps the array when nothing changed", () => {
    const store = createStore();

    store.replaceAll({ seq: 1, cols: [], rows: [row(1, "a")] });
    const items = store.items;

    store.applyDelta({ s: 2, a: [], c: [[9, 4, 1]], d: [8] });

    expect(store.items).toBe(items);
  });

  it("replaces an added row that is already known", () => {
    const store = createStore();

    store.replaceAll({ seq: 1, cols: [], rows: [row(1, "a")] });
    store.applyDelta({ s: 2, a: [row(1, "a", "default", { restarts: 2 })], c: [], d: [] });

    expect(store.items).toHaveLength(1);
    expect(store.getById(1)?.restarts).toBe(2);
  });

  it("lists the items of the selected namespaces, and leaves out completed pods when asked", () => {
    let namespaces = ["default"];
    let hideCompleted = false;
    const store = new PodRowStore({
      fetch: () => Promise.reject(new Error("not used")),
      baseUrl: "/api-rows",
      getContextNamespaces: () => namespaces,
      hideCompletedPods: () => hideCompleted,
    });

    store.replaceAll({
      seq: 1,
      cols: [],
      rows: [row(1, "a"), row(2, "b", "other"), row(3, "c", "default", { status: "Succeeded" })],
    });

    expect(store.contextItems.map((item) => item.getName())).toEqual(["a", "c"]);
    expect(store.getTotalCount()).toBe(2);

    hideCompleted = true;
    namespaces = ["default", "other"];

    // Not observed here, so a new computation reads the new values
    expect(createStoreFrom(store).map((item) => item.getName())).toEqual(["a", "b"]);
  });

  it("finds the item of a pod path", () => {
    const store = createStore();

    store.replaceAll({ seq: 1, cols: [], rows: [row(1, "a"), row(2, "a", "other")] });

    expect(store.getByPath("/api/v1/namespaces/other/pods/a")?.getId()).toBe("2");
    expect(store.getByPath("/api/v1/namespaces/other/pods/missing")).toBeUndefined();
    expect(store.getByPath(undefined)).toBeUndefined();
  });
});

// A computed read outside a reaction is recomputed, so this reads the current values
const createStoreFrom = (store: PodRowStore) => store.contextItems;

describe("sorting the Pods rows", () => {
  const callbacks = Object.fromEntries(podRowColumns.map((column) => [column.id, column.sortingCallBack]));
  const sortBy = (id: string, items: PodRowItem[]) =>
    [...items].sort((a, b) => {
      const x = callbacks[id](a) as number | string;
      const y = callbacks[id](b) as number | string;

      return x < y ? -1 : x > y ? 1 : 0;
    });

  const items = [
    new PodRowItem(row(1, "pod-10", "default", { restarts: 5, created: 3000, cpuRequest: 0.5 })),
    new PodRowItem(row(2, "pod-2", "default", { restarts: 1, created: 1000, cpuRequest: null })),
    new PodRowItem(row(3, "pod-1", "default", { restarts: 3, created: 2000, cpuRequest: 0.1 })),
  ];

  it("sorts by restarts", () => {
    expect(sortBy("restarts", items).map((item) => item.getName())).toEqual(["pod-2", "pod-1", "pod-10"]);
  });

  it("sorts the age newest first, as the list of full pods does", () => {
    expect(sortBy("age", items).map((item) => item.getName())).toEqual(["pod-10", "pod-1", "pod-2"]);
  });

  it("sorts pods without a request first", () => {
    expect(sortBy("cpuRequest", items).map((item) => item.getName())).toEqual(["pod-2", "pod-1", "pod-10"]);
  });

  it("gives the name the natural order parts", () => {
    const parts = callbacks.name(items[0]);

    expect(parts).toEqual(callbacks.name(new PodRowItem(row(9, "pod-10"))));
    expect(Array.isArray(parts)).toBe(true);
  });

  it("keeps the same ids of the columns as the list of full pods", () => {
    expect(podRowColumns.map((column) => column.id)).toEqual([
      "name",
      "namespace",
      "containers",
      "cpuRequest",
      "cpuLimit",
      "memoryRequest",
      "memoryLimit",
      "restarts",
      "owners",
      "node",
      "qos",
      "age",
      "status",
    ]);
  });
});

describe("PodRowStore.start", () => {
  const encoder = new TextEncoder();

  it("holds the deltas that arrive before the snapshot, and applies only the newer ones", async () => {
    let pushLine: (line: string) => void = () => {};
    const watchBody = new ReadableStream<Uint8Array>({
      start(controller) {
        pushLine = (line) => controller.enqueue(encoder.encode(`${line}\n`));
      },
    });
    const snapshot = { seq: 5, cols: [], rows: [row(1, "a"), row(2, "b")] };
    const fakeFetch = (async (input: string) => {
      if (input.endsWith("/rows/watch")) {
        // One delta the snapshot has, one it has not
        pushLine(JSON.stringify({ s: 5, a: [], c: [], d: [2] }));
        pushLine(JSON.stringify({ s: 6, a: [row(3, "c")], c: [], d: [] }));

        return new Response(watchBody);
      }

      return new Response(JSON.stringify(snapshot));
    }) as unknown as typeof fetch;
    const store = new PodRowStore({
      fetch: fakeFetch,
      baseUrl: "/api-rows",
      getContextNamespaces: () => ["default"],
      hideCompletedPods: () => false,
    });
    const stop = store.start();

    await vi.waitFor(() => expect(store.seq).toBe(6));

    expect(store.items.map((item) => item.getName())).toEqual(["a", "b", "c"]);

    pushLine(JSON.stringify({ s: 7, a: [], c: [], d: [1] }));
    await vi.waitFor(() => expect(store.items.map((item) => item.getName())).toEqual(["b", "c"]));

    stop();
  });

  it("marks the store unavailable on a 501 and stops asking, until it is reset", async () => {
    const fakeFetch = vi.fn(async () => new Response("Rows service unavailable: the option is off", { status: 501 }));
    const store = new PodRowStore({
      fetch: fakeFetch as unknown as typeof fetch,
      baseUrl: "/api-rows",
      getContextNamespaces: () => ["default"],
      hideCompletedPods: () => false,
    });
    const stop = store.start();

    await vi.waitFor(() => expect(store.unavailable).toBe(true));

    const calls = fakeFetch.mock.calls.length;

    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(fakeFetch.mock.calls.length).toBe(calls);
    expect(store.failedLoading).toBe(false);

    store.resetUnavailable();
    expect(store.unavailable).toBe(false);

    stop();
  });

  it("loads the snapshot again when a batch is missing from the stream", async () => {
    const pushers: ((line: string) => void)[] = [];
    let snapshots = 0;
    const fakeFetch = (async (input: string) => {
      if (input.endsWith("/rows/watch")) {
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              pushers.push((line) => controller.enqueue(encoder.encode(`${line}\n`)));
            },
          }),
        );
      }

      snapshots += 1;

      return new Response(
        JSON.stringify(
          snapshots === 1
            ? { seq: 1, cols: [], rows: [row(1, "a")] }
            : { seq: 9, cols: [], rows: [row(1, "a"), row(2, "b"), row(3, "c")] },
        ),
      );
    }) as unknown as typeof fetch;
    const store = new PodRowStore({
      fetch: fakeFetch,
      baseUrl: "/api-rows",
      getContextNamespaces: () => ["default"],
      hideCompletedPods: () => false,
    });
    const stop = store.start();

    await vi.waitFor(() => expect(store.seq).toBe(1));

    // Batch 2 never arrives: batch 3 must not be applied over it
    pushers[0](JSON.stringify({ s: 3, a: [row(3, "c")], c: [], d: [] }));

    await vi.waitFor(() => expect(store.seq).toBe(9), { timeout: 3000 });
    expect(snapshots).toBe(2);
    expect(store.items.map((item) => item.getName())).toEqual(["a", "b", "c"]);

    stop();
  });
});
