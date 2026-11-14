/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { describeEntry, Timeline } from "./timeline";

import type { ClusterViewState } from "./channels";

const view = (path: string, extra: Partial<ClusterViewState> = {}): ClusterViewState => ({
  path,
  namespaces: ["default"],
  expanded: {},
  scrollTop: 0,
  ...extra,
});

const pods = { rootPath: "/cluster/c1", clusterId: "c1", cluster: view("/pods") };

describe("Timeline", () => {
  it("goes back and forward through the steps, and a new step drops the ones ahead", () => {
    const timeline = new Timeline();

    timeline.record({ rootPath: "/catalog" });
    timeline.record(pods);
    timeline.record({ ...pods, cluster: view("/pods", { namespaces: ["kube-system"] }) });

    expect(timeline.go(-1)).toBe(timeline.entries[1]);
    expect(timeline.go(-1)?.rootPath).toBe("/catalog");
    expect(timeline.canGo(-1)).toBe(false);
    expect(timeline.go(1)).toBe(timeline.entries[1]);

    timeline.record({ ...pods, cluster: view("/deployments") });
    expect(timeline.entries).toHaveLength(3);
    expect(timeline.canGo(1)).toBe(false);
  });

  it("keeps a scroll as part of the current step", () => {
    const timeline = new Timeline();

    timeline.record(pods);
    timeline.record({ ...pods, cluster: view("/pods", { scrollTop: 400 }) });

    expect(timeline.entries).toHaveLength(1);
    expect(timeline.current?.cluster?.scrollTop).toBe(400);
  });

  it("lists the steps around the current one, nearest first", () => {
    const timeline = new Timeline();

    timeline.record({ rootPath: "/welcome" });
    timeline.record({ rootPath: "/catalog" });
    timeline.record(pods);

    expect(timeline.around(-1).map(({ delta, entry }) => [delta, entry.rootPath])).toEqual([
      [-1, "/catalog"],
      [-2, "/welcome"],
    ]);
  });
});

describe("describeEntry", () => {
  it("names the view and what is shown in it", () => {
    expect(describeEntry({ rootPath: "/catalog" })).toBe("Catalog");
    expect(
      describeEntry(
        {
          ...pods,
          cluster: view("/pods?kube-details=/api/v1/namespaces/default/pods/nginx-1&search=ngin", {
            expanded: { pods: ["a", "b"] },
          }),
        },
        () => "homelab",
      ),
    ).toBe('homelab: Pods · in default · details of nginx-1 · search "ngin" · 2 rows open');
    expect(describeEntry({ ...pods, cluster: view("/pods", { namespaces: ["a", "b", "c"] }) })).toBe(
      "Pods · in 3 namespaces",
    );
  });
});
