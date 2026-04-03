/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { buildOwnerIndex } from "../kube-object.store";

// Minimal mock of KubeObject with metadata.ownerReferences
function mockItem(uid: string, ownerUids: string[]) {
  return {
    metadata: {
      uid,
      ownerReferences: ownerUids.map((ownerUid) => ({
        uid: ownerUid,
        apiVersion: "v1",
        kind: "ReplicaSet",
        name: `rs-${ownerUid}`,
      })),
    },
  } as any;
}

describe("buildOwnerIndex", () => {
  it("returns empty map for empty array", () => {
    const result = buildOwnerIndex([]);

    expect(result.size).toBe(0);
  });

  it("groups items by owner uid", () => {
    const pod1 = mockItem("pod-1", ["rs-1"]);
    const pod2 = mockItem("pod-2", ["rs-1"]);
    const pod3 = mockItem("pod-3", ["rs-2"]);

    const result = buildOwnerIndex([pod1, pod2, pod3]);

    expect(result.get("rs-1")).toEqual([pod1, pod2]);
    expect(result.get("rs-2")).toEqual([pod3]);
    expect(result.size).toBe(2);
  });

  it("handles items with multiple owners", () => {
    const pod = mockItem("pod-1", ["owner-a", "owner-b"]);

    const result = buildOwnerIndex([pod]);

    expect(result.get("owner-a")).toEqual([pod]);
    expect(result.get("owner-b")).toEqual([pod]);
    expect(result.size).toBe(2);
  });

  it("handles items with no owner references", () => {
    const item = { metadata: { uid: "standalone" } } as any;

    const result = buildOwnerIndex([item]);

    expect(result.size).toBe(0);
  });

  it("handles items with undefined ownerReferences", () => {
    const item = { metadata: { uid: "no-refs", ownerReferences: undefined } } as any;

    const result = buildOwnerIndex([item]);

    expect(result.size).toBe(0);
  });
});
