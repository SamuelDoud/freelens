/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Pod } from "@freelensapp/kube-object";
import { describe, expect, it } from "vitest";
import { getPodResources } from "./pod-resources";

const Mi = 2 ** 20;

const pod = (spec: object) =>
  new Pod({
    apiVersion: "v1",
    kind: "Pod",
    metadata: {
      name: "p",
      namespace: "default",
      uid: "p",
      resourceVersion: "1",
      selfLink: "/api/v1/namespaces/default/pods/p",
    },
    spec: spec as never,
  });

const container = (name: string, requests?: object, limits?: object, extra: object = {}) => ({
  name,
  image: "pause",
  resources: { requests, limits },
  ...extra,
});

describe("getPodResources", () => {
  it("adds up the containers", () => {
    const resources = getPodResources(
      pod({
        containers: [
          container("a", { cpu: "250m", memory: "128Mi" }, { cpu: "500m", memory: "256Mi" }),
          container("b", { cpu: "250m", memory: "128Mi" }, { cpu: "1", memory: "256Mi" }),
        ],
      }),
    );

    expect(resources).toEqual({ cpuRequest: 0.5, cpuLimit: 1.5, memoryRequest: 256 * Mi, memoryLimit: 512 * Mi });
  });

  it("has no limit when a container has none, and no request when none is set", () => {
    const resources = getPodResources(
      pod({ containers: [container("a", undefined, { cpu: "1" }), container("b", undefined, undefined)] }),
    );

    expect(resources.cpuLimit).toBeUndefined();
    expect(resources.memoryRequest).toBeUndefined();
  });

  it("takes the larger of the init containers and the running ones, sidecars running alongside both", () => {
    const resources = getPodResources(
      pod({
        initContainers: [
          container("sidecar", { cpu: "100m" }, undefined, { restartPolicy: "Always" }),
          container("migrate", { cpu: "2" }),
        ],
        containers: [container("app", { cpu: "500m" })],
        overhead: { cpu: "50m" },
      }),
    );

    // The init container runs next to the sidecar: 2 + 0.1, over 0.5 + 0.1; plus the overhead.
    expect(resources.cpuRequest).toBeCloseTo(2.15, 9);
  });
});
