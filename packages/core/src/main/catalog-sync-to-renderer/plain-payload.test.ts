/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { serialize } from "node:v8";
import { isObservable, observable } from "mobx";
import { describe, expect, it } from "vitest";
import { KubernetesCluster } from "../../common/catalog-entities";
import { toJS } from "../../common/utils";

const containsObservable = (value: unknown): boolean => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return isObservable(value) || Object.values(value).some(containsObservable);
};

describe("the catalog payload after the first toJS", () => {
  const items = observable.array(
    Array.from(
      { length: 20 },
      (_, i) =>
        new KubernetesCluster({
          metadata: { uid: `uid-${i}`, name: `name-${i}`, labels: { file: `f-${i}` }, nodes: i },
          spec: {
            kubeconfigPath: "/kc",
            kubeconfigContext: `ctx-${i}`,
            icon: { background: "#123456" },
            accessibleNamespaces: ["a", "b"],
          },
          status: { phase: "connected", reason: "" },
        }),
    ),
  );

  it("is plain, so a second toJS is a structural copy that a frame cannot tell apart", () => {
    const first = toJS(items);
    const second = toJS(first);

    expect(containsObservable(first)).toBe(false);
    expect(second).toStrictEqual(first);
    expect(serialize(second).equals(serialize(first))).toBe(true);
  });
});
