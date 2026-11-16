/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Pod } from "@freelensapp/kube-object";
import { describe, expect, it } from "vitest";
import { parseQuantity } from "../../../common/utils/k8s-quantity";
import { getPodResources } from "./pod-resources";

import type { Container } from "@freelensapp/kube-object";

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

  it("gives the same object for the same pod, and new amounts for a changed copy", () => {
    const original = pod({ containers: [container("a", { cpu: "250m" })] });
    const changed = pod({ containers: [container("a", { cpu: "1" })] });

    expect(getPodResources(original)).toBe(getPodResources(original));
    expect(Object.isFrozen(getPodResources(original))).toBe(true);
    expect(getPodResources(original).cpuRequest).toBe(0.25);
    expect(getPodResources(changed).cpuRequest).toBe(1);
  });

  // The amounts as they were worked out for every amount separately.
  const referenceAmount = (
    containers: Container[],
    initContainers: Container[],
    overhead: Record<string, string> | undefined,
    kind: "requests" | "limits",
    resource: "cpu" | "memory",
  ) => {
    const amountOf = (c: Container) => parseQuantity(c.resources?.[kind]?.[resource]);
    const amounts = [...containers, ...initContainers].map(amountOf);

    if (kind === "limits" ? amounts.some((a) => a === undefined) : amounts.every((a) => a === undefined)) {
      return undefined;
    }

    let sidecars = 0;
    let initPeak = 0;

    for (const c of initContainers) {
      const amount = amountOf(c) ?? 0;

      if (c.restartPolicy === "Always") {
        sidecars += amount;
      } else {
        initPeak = Math.max(initPeak, sidecars + amount);
      }
    }

    const running = containers.reduce((sum, c) => sum + (amountOf(c) ?? 0), sidecars);

    return Math.max(running, initPeak) + (parseQuantity(overhead?.[resource]) ?? 0);
  };

  it("matches the amounts worked out one at a time, for random pods", () => {
    let seed = 3;
    const next = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;

      return seed / 4294967296;
    };
    const pick = <T>(values: T[]) => values[Math.floor(next() * values.length)];
    const cpu = ["100m", "250m", "0.5", "1", "2", "1500m", "nonsense", "", undefined, "1e-1"];
    const memory = ["128Mi", "256Mi", "1Gi", "1.5Gi", "500M", "bogus", undefined, "1e9"];
    const makeContainers = (count: number, init: boolean) =>
      Array.from({ length: count }, (_, index) =>
        container(
          `c${index}`,
          { cpu: pick(cpu), memory: pick(memory) },
          next() < 0.7 ? { cpu: pick(cpu), memory: pick(memory) } : undefined,
          init && next() < 0.4 ? { restartPolicy: "Always" } : {},
        ),
      );

    for (let round = 0; round < 300; round++) {
      const containers = makeContainers(Math.floor(next() * 4), false);
      const initContainers = makeContainers(Math.floor(next() * 3), true);
      const overhead = next() < 0.3 ? { cpu: pick(cpu) as string, memory: pick(memory) as string } : undefined;
      const resources = getPodResources(pod({ containers, initContainers, overhead }));
      const typed = (list: object[]) => list as Container[];

      expect(resources).toStrictEqual({
        cpuRequest: referenceAmount(typed(containers), typed(initContainers), overhead, "requests", "cpu"),
        cpuLimit: referenceAmount(typed(containers), typed(initContainers), overhead, "limits", "cpu"),
        memoryRequest: referenceAmount(typed(containers), typed(initContainers), overhead, "requests", "memory"),
        memoryLimit: referenceAmount(typed(containers), typed(initContainers), overhead, "limits", "memory"),
      });
    }
  });
});
