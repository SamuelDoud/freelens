/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { namespaceSelectFilterModelFor } from "./namespace-select-filter-model";

import type { ClusterContext } from "../../../cluster-frame-context/cluster-frame-context";
import type { NamespaceStore } from "../store";

describe("namespaceSelectFilterModelFor", () => {
  it("does not reorder the namespaces of the cluster context when it lists the options", () => {
    const allNamespaces = ["a", "b", "c"];
    const context = {
      allNamespaces,
      contextNamespaces: ["c"],
      hasSelectedAll: false,
    } as unknown as ClusterContext;
    const model = namespaceSelectFilterModelFor({
      context,
      namespaceStore: {} as NamespaceStore,
      isSelectionModifierKey: () => false,
    });

    // The selected namespace goes first in the options, not in the context's own list.
    expect(model.options.get().map(({ id }) => id)).toEqual(["all-namespaces", "c", "a", "b"]);
    expect(allNamespaces).toEqual(["a", "b", "c"]);
  });
});
