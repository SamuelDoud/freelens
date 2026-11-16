/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it, vi } from "vitest";
import { getDiForUnitTesting } from "../../../../renderer/getDiForUnitTesting";
import apiBaseInjectable from "../../api-base.injectable";
import { escapePrometheusRegex } from "./escape-prometheus-regex";
import requestPodMetricsInjectable from "./request-pod-metrics.injectable";
import requestPodMetricsForDeploymentsInjectable from "./request-pod-metrics-for-deployments.injectable";

import type { Deployment, Pod } from "@freelensapp/kube-object";

// What Prometheus does with the string literal and the regex: unescape the string, then match the whole name.
const matches = (promqlRegex: string, name: string) => {
  const source = promqlRegex.replace(/\\\\/g, "\\").replace(/\[\[:alnum:]]/g, "[a-z0-9]");

  return new RegExp(`^(?:${source})$`).test(name);
};

const podsSelectorOf = async (call: (post: ReturnType<typeof vi.fn>) => Promise<unknown>) => {
  const post = vi.fn().mockResolvedValue({});

  await call(post);

  return post.mock.calls[0][1].data.cpuUsage.pods as string;
};

describe("the pods of a Prometheus query", () => {
  it("writes a dot of a name as a dot, not as any character", async () => {
    const selector = await podsSelectorOf(async (post) => {
      const di = getDiForUnitTesting();

      di.override(apiBaseInjectable, () => ({ post }) as never);
      await di.inject(requestPodMetricsInjectable)(
        [{ getName: () => "web.1" } as Pod],
        "default",
        undefined,
        "pod, namespace",
        { metrics: ["cpuUsage"] },
      );
    });

    expect(selector).toBe(escapePrometheusRegex("web.1"));
    expect(matches(selector, "web.1")).toBe(true);
    expect(matches(selector, "webx1")).toBe(false);
  });

  it("leaves a deployment the pods of its own ReplicaSets only", async () => {
    const selector = await podsSelectorOf(async (post) => {
      const di = getDiForUnitTesting();

      di.override(apiBaseInjectable, () => ({ post }) as never);
      await di.inject(requestPodMetricsForDeploymentsInjectable)([{ getName: () => "api" } as Deployment], "default");
    });

    expect(matches(selector, "api-5d8f9c7b6-abcde")).toBe(true);
    expect(matches(selector, "api-gateway-xxxxxxxxx-5d8f9c7b6-abcde")).toBe(false);
    expect(matches(selector, "api-gateway-xxxxxxxxx-abcde")).toBe(false);
    expect(matches(selector, "api-abcdefghijk-abcde")).toBe(false);
  });
});
