/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { computed } from "mobx";
import { describe, expect, it, vi } from "vitest";
import { getDiForUnitTesting } from "../../getDiForUnitTesting";
import selectedMetricsTimeRangeInjectable from "../cluster/overview/selected-metrics-time-range.injectable";
import { createTimeRangedMetricsInjectable, maxObjectsWithCachedMetrics } from "./create-time-ranged-metrics";

interface TestObject {
  id: string;
}

describe("the metrics of the objects that were opened", () => {
  function setup(id: string) {
    const di = getDiForUnitTesting();
    const request = vi.fn(async ({ object }: { object: TestObject }) => ({ for: object.id }));
    const injectable = createTimeRangedMetricsInjectable<{ object: TestObject }, TestObject, { for: string }>({
      id,
      getObject: ({ object }) => object,
      getObjectId: (object) => object.id,
      request,
    });

    di.register(injectable);
    di.override(
      selectedMetricsTimeRangeInjectable,
      () => ({ timestamps: computed(() => ({ start: 1000, end: 4600, range: 3600 })) }) as never,
    );

    const open = async (object: TestObject) => {
      const metrics = di.inject(injectable, { object });

      metrics.value.get();
      await vi.waitFor(() => expect(metrics.value.get()).toEqual({ for: object.id }));

      return metrics;
    };

    return { open, request, di, injectable };
  }

  it("fetches again an object opened long ago, and finds what a recent one fetched", async () => {
    const { open, request } = setup("lru-test-metrics");
    const objects = Array.from({ length: maxObjectsWithCachedMetrics + 10 }, (_, index) => ({ id: `object-${index}` }));

    for (const object of objects) {
      await open(object);
    }

    expect(request).toHaveBeenCalledTimes(objects.length);

    // A recent object: its response is still there.
    await open(objects[objects.length - 1]);
    await open(objects[objects.length - maxObjectsWithCachedMetrics]);
    expect(request).toHaveBeenCalledTimes(objects.length);

    // The first one was let go and is fetched when it is opened again.
    await open(objects[0]);
    expect(request).toHaveBeenCalledTimes(objects.length + 1);
  });

  it("keeps an object that is used again and again, however many others are opened", async () => {
    const { open, request } = setup("lru-test-metrics-busy");
    const busy = { id: "busy" };

    await open(busy);

    for (let index = 0; index < maxObjectsWithCachedMetrics * 2; index += 1) {
      await open({ id: `other-${index}` });
      await open(busy);
    }

    expect(request.mock.calls.filter(([{ object }]) => object.id === "busy")).toHaveLength(1);
  });

  it("does not show the response of a request that was still running when the object was let go", async () => {
    const { di, injectable, request } = setup("lru-test-metrics-late");
    let answerLate: (value: { for: string }) => void = () => {};

    request.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          answerLate = resolve;
        }),
    );

    const first = di.inject(injectable, { object: { id: "first" } });

    first.value.get();

    for (let index = 0; index < maxObjectsWithCachedMetrics; index += 1) {
      di.inject(injectable, { object: { id: `other-${index}` } });
    }

    answerLate({ for: "late" });
    await Promise.resolve();
    await Promise.resolve();

    expect(first.value.get()).not.toEqual({ for: "late" });
  });
});
