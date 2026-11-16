/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it, vi } from "vitest";
import { getDiForUnitTesting } from "../getDiForUnitTesting";
import k8sRequestInjectable from "../k8s-request.injectable";
import clusterNodeCountDetectorInjectable from "./cluster-nodes-count-detector.injectable";

import type { Cluster } from "../../common/cluster/cluster";

const detectWith = async (k8sRequest: (...args: any[]) => Promise<unknown>) => {
  const di = getDiForUnitTesting();

  di.override(k8sRequestInjectable, () => k8sRequest as any);

  return di.inject(clusterNodeCountDetectorInjectable).detect({ id: "c" } as Cluster);
};

const nodes = (n: number) => Array.from({ length: n }, (_, i) => ({ metadata: { name: `n${i}` } }));

describe("cluster node count detector", () => {
  it("counts the rows of a table response, which carries no objects", async () => {
    const request = vi.fn(async () => ({ kind: "Table", rows: nodes(333) }));

    expect(await detectWith(request)).toEqual({ value: 333, accuracy: 1000 });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      { id: "c" },
      "/api/v1/nodes?includeObject=None",
      expect.objectContaining({ headers: { Accept: expect.stringContaining("as=Table") } }),
    );
  });

  it("counts an empty table as no nodes", async () => {
    expect(await detectWith(async () => ({ kind: "Table", rows: [] }))).toEqual({ value: 0, accuracy: 1000 });
  });

  it("counts the items when the server ignores the table request", async () => {
    expect(await detectWith(async () => ({ kind: "NodeList", items: nodes(7) }))).toEqual({
      value: 7,
      accuracy: 1000,
    });
  });

  it("falls back to the full list when the table is refused", async () => {
    const request = vi.fn(async (_c: unknown, path: string) => {
      if (path.includes("includeObject")) {
        throw Object.assign(new Error("not acceptable"), { statusCode: 406 });
      }

      return { items: nodes(5) };
    });

    expect(await detectWith(request)).toEqual({ value: 5, accuracy: 1000 });
    expect(request).toHaveBeenLastCalledWith({ id: "c" }, "/api/v1/nodes");
  });

  it("detects nothing when both requests fail", async () => {
    expect(
      await detectWith(async () => {
        throw new Error("down");
      }),
    ).toBeNull();
  });
});
