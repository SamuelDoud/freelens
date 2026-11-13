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

class LookupStore extends KubeObjectStore<KubeObject> {
  constructor(public contextNamespaces: string[] = []) {
    super(
      {
        context: {
          allNamespaces: [],
          get contextNamespaces() {
            return contextNamespaces;
          },
          hasSelectedAll: false,
          isGlobalWatchEnabled: () => true,
          isLoadingAll: () => true,
        },
        logger: { debug: noop, error: noop, info: noop, silly: noop, warn: noop },
      },
      { isNamespaced: true } as KubeApi<KubeObject>,
    );
  }
}

const obj = (name: string, opts: { uid?: string; ns?: string; selfLink?: string; owners?: any[] } = {}) =>
  new KubeObject({
    apiVersion: "v1",
    kind: "Foo",
    metadata: {
      name,
      resourceVersion: "1",
      uid: opts.uid ?? `uid-${name}`,
      namespace: opts.ns,
      selfLink: opts.selfLink ?? `/link/${name}`,
      ownerReferences: opts.owners,
    } as any,
  });

const repeat = <T>(fn: () => T, times = 4) => Array.from({ length: times }, fn);

describe("KubeObjectStore lookups", () => {
  describe("getById", () => {
    it("returns the first of items sharing an id, and undefined for a miss", () => {
      const store = new LookupStore();
      const a = obj("a", { uid: "same" });
      const b = obj("b", { uid: "same" });
      const c = obj("c");

      store.items.replace([a, b, c]);

      expect(repeat(() => store.getById("same"))).toEqual([a, a, a, a]);
      expect(repeat(() => store.getById("uid-c"))).toEqual([c, c, c, c]);
      expect(repeat(() => store.getById("nope"))).toEqual([undefined, undefined, undefined, undefined]);
    });

    it("follows every way items changes", () => {
      const store = new LookupStore();
      const a = obj("a");
      const b = obj("b");
      const a2 = obj("a2", { uid: "uid-a" });

      store.items.replace([a]);
      repeat(() => store.getById("uid-a"));
      expect(store.getById("uid-b")).toBeUndefined();

      store.items.push(b);
      repeat(() => store.getById("uid-b"));
      expect(store.getById("uid-b")).toBe(b);

      store.items[0] = a2;
      repeat(() => store.getById("uid-a"));
      expect(store.getById("uid-a")).toBe(a2);

      store.items.remove(b);
      repeat(() => store.getById("uid-b"));
      expect(store.getById("uid-b")).toBeUndefined();

      store.items.splice(0, 0, a);
      repeat(() => store.getById("uid-a"));
      expect(store.getById("uid-a")).toBe(a);

      store.items.clear();
      repeat(() => store.getById("uid-a"));
      expect(store.getById("uid-a")).toBeUndefined();
    });

    it("re-runs a reaction that used it when items change", () => {
      const store = new LookupStore();
      const seen: (KubeObject | undefined)[] = [];
      const a = obj("a");

      const dispose = autorun(() => seen.push(store.getById("uid-a")));

      runInAction(() => store.items.push(a));
      runInAction(() => store.items.clear());
      dispose();

      expect(seen).toEqual([undefined, a, undefined]);
    });
  });

  describe("getByPath", () => {
    it("returns the first of items sharing a path, and undefined for a miss", () => {
      const store = new LookupStore();
      const a = obj("a", { selfLink: "/same" });
      const b = obj("b", { selfLink: "/same" });
      const empty = obj("e", { selfLink: "" });

      store.items.replace([a, b, empty]);

      expect(repeat(() => store.getByPath("/same"))).toEqual([a, a, a, a]);
      expect(repeat(() => store.getByPath(""))).toEqual([empty, empty, empty, empty]);
      expect(repeat(() => store.getByPath("/nope"))).toEqual([undefined, undefined, undefined, undefined]);
    });

    it("returns undefined for an empty path when no item has an empty selfLink", () => {
      const store = new LookupStore();

      store.items.replace([obj("a")]);

      expect(repeat(() => store.getByPath(""))).toEqual([undefined, undefined, undefined, undefined]);
    });

    it("follows changes of items", () => {
      const store = new LookupStore();
      const a = obj("a");
      const a2 = obj("a2", { selfLink: "/link/a" });

      store.items.replace([a]);
      repeat(() => store.getByPath("/link/a"));
      store.items.replace([a2]);

      expect(repeat(() => store.getByPath("/link/a"))).toEqual([a2, a2, a2, a2]);
    });
  });

  describe("getAllByNs", () => {
    const setup = () => {
      const store = new LookupStore();
      const items = [
        obj("a", { ns: "x" }),
        obj("b", { ns: "y" }),
        obj("c"),
        obj("d", { ns: "x" }),
        obj("e", { ns: "z" }),
      ];

      store.items.replace(items);

      return { store, items };
    };

    it("keeps order and matches a single namespace or a list", () => {
      const { store, items } = setup();

      expect(store.getAllByNs("x")).toEqual([items[0], items[3]]);
      expect(store.getAllByNs(["z", "x"])).toEqual([items[0], items[3], items[4]]);
      expect(store.getAllByNs(["nope"])).toEqual([]);
    });

    it("does not match cluster-scoped items by namespace", () => {
      const { store } = setup();

      expect(store.getAllByNs([""])).toEqual([]);
    });

    it("returns all items for an empty list unless strict", () => {
      const { store, items } = setup();

      expect(store.getAllByNs([])).toBe(store.items);
      expect(store.getAllByNs([], true)).toEqual([]);
      expect(store.getAllByNs([], false)).toEqual(items);
    });
  });

  describe("contextItems", () => {
    it("keeps cluster-wide items and items in selected namespaces, in order", () => {
      const store = new LookupStore(["x", "z"]);
      const items = [obj("a", { ns: "x" }), obj("b", { ns: "y" }), obj("c"), obj("d", { ns: "z" })];

      store.items.replace(items);

      expect(store.contextItems).toEqual([items[0], items[2], items[3]]);
      expect(store.getTotalCount()).toBe(3);
    });

    it("is empty of namespaced items when no namespace is selected", () => {
      const store = new LookupStore([]);
      const items = [obj("a", { ns: "x" }), obj("c")];

      store.items.replace(items);

      expect(store.contextItems).toEqual([items[1]]);
    });
  });

  describe("getByOwnerReference", () => {
    it("matches on namespace, kind, name and optionally apiVersion", () => {
      const store = new LookupStore();
      const owner = (apiVersion: string, kind: string, name: string) => ({ apiVersion, kind, name, uid: "u" });
      const a = obj("a", { ns: "x", owners: [owner("v1", "Other", "o"), owner("apps/v1", "Job", "j")] });
      const b = obj("b", { ns: "y", owners: [owner("apps/v1", "Job", "j")] });
      const c = obj("c", { ns: "x", owners: [owner("batch/v1", "Job", "j")] });
      const d = obj("d", { ns: "x" });

      store.items.replace([a, b, c, d]);

      expect(store.getByOwnerReference("apps/v1", "Job", "j", "x")).toEqual([a]);
      expect(store.getByOwnerReference(undefined, "Job", "j", "x")).toEqual([a, c]);
      expect(store.getByOwnerReference("apps/v1", "Job", "nope", "x")).toEqual([]);
    });
  });
});
