/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { getNamespaceSearchKey } from "./search-input-url";

type NamespaceStore = Parameters<typeof getNamespaceSearchKey>[0];

const storeWith = (selected: string[], all: string[]) =>
  ({
    areAllSelectedImplicitly: selected.length === 0,
    contextNamespaces: selected.length > 0 ? selected : all,
  }) as unknown as NamespaceStore;

describe("getNamespaceSearchKey", () => {
  it("uses one key outside a cluster", () => {
    expect(getNamespaceSearchKey(undefined)).toBe("global");
  });

  it("keeps the all-namespaces key when a namespace is created", () => {
    const before = getNamespaceSearchKey(storeWith([], ["default", "kube-system"]));
    const after = getNamespaceSearchKey(storeWith([], ["default", "kube-system", "new-namespace"]));

    expect(before).toBe("all-namespaces");
    expect(after).toBe(before);
  });

  it("keys a selection by its namespaces, in any order", () => {
    expect(getNamespaceSearchKey(storeWith(["kube-system", "default"], ["default", "kube-system", "other"]))).toBe(
      "default,kube-system",
    );
  });
});
