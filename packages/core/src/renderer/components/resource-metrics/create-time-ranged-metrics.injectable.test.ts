/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const asyncComputedMock = vi.fn((options: unknown) => Object.assign(options as object, { release: vi.fn() }));
const nowMock = vi.fn();

vi.mock("../../../common/utils/async-computed", async (importOriginal) => {
  const actual = await importOriginal<object>();

  return {
    ...actual,
    asyncComputed: (options: unknown) => asyncComputedMock(options),
  };
});

vi.mock("mobx-utils", async (importOriginal) => {
  const actual = await importOriginal<object>();

  return {
    ...actual,
    now: (interval: number) => nowMock(interval),
  };
});

import { getDiForUnitTesting } from "../../getDiForUnitTesting";
import selectedMetricsTimeRangeInjectable from "../cluster/overview/selected-metrics-time-range.injectable";
import { createTimeRangedMetricsInjectable } from "./create-time-ranged-metrics";

interface TestObject {
  getId: () => string;
}

type IsAny<T> = 0 extends 1 & T ? true : false;
type AssertFalse<T extends false> = T;

describe("createTimeRangedMetricsInjectable", () => {
  beforeEach(() => {
    asyncComputedMock.mockClear();
    nowMock.mockClear();
  });

  it("forwards selected start/end/range without subscribing to an extra refresh clock", async () => {
    const di = getDiForUnitTesting();
    const request = vi.fn().mockResolvedValue({});
    const timestampsGet = vi.fn(() => ({ start: 2000, end: 2100, range: 100 }));
    const object: TestObject = {
      getId: () => "resource-id",
    };

    const injectable = createTimeRangedMetricsInjectable<{ object: TestObject }, TestObject, unknown>({
      id: "test-time-ranged-metrics",
      getObject: ({ object }) => object,
      getObjectId: (resource) => resource.getId(),
      request: async ({ object, start, end, range }) => request({ object, start, end, range }),
    });
    type InjectableShouldNotBeAny = AssertFalse<IsAny<typeof injectable>>;
    const injectableShouldNotBeAny: InjectableShouldNotBeAny = false;

    expect(injectableShouldNotBeAny).toBe(false);

    di.register(injectable);

    di.override(
      selectedMetricsTimeRangeInjectable,
      () =>
        ({
          timestamps: {
            get: timestampsGet,
          },
          value: { get: () => ({ duration: null }) },
        }) as never,
    );

    di.inject(injectable, {
      object,
    });
    const asyncComputedConfiguration = asyncComputedMock.mock.calls[0]?.[0] as {
      getValueFromObservedPromise: () => Promise<unknown>;
    };

    await asyncComputedConfiguration.getValueFromObservedPromise();

    expect(request).toHaveBeenCalledWith({
      object,
      start: 2000,
      end: 2100,
      range: 100,
    });
    expect(nowMock).not.toHaveBeenCalled();
    expect(timestampsGet).toHaveBeenCalled();
    expect(asyncComputedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        betweenUpdates: "show-latest-value",
      }),
    );
  });

  it("keys instances by object identity", () => {
    const di = getDiForUnitTesting();
    const objectA: TestObject = {
      getId: () => "resource-a",
    };
    const objectB: TestObject = {
      getId: () => "resource-b",
    };

    const injectable = createTimeRangedMetricsInjectable<{ object: TestObject }, TestObject, unknown>({
      id: "test-time-ranged-metrics-identity",
      getObject: ({ object }) => object,
      getObjectId: (resource) => resource.getId(),
      request: async () => ({}),
    });

    di.register(injectable);

    di.override(
      selectedMetricsTimeRangeInjectable,
      () =>
        ({
          value: { get: () => ({ duration: null }) },
          timestamps: {
            get: () => ({ start: 2000, end: 2100, range: 100 }),
          },
        }) as never,
    );

    const metricsForObjectA = di.inject(injectable, {
      object: objectA,
    });
    const metricsForObjectAAgain = di.inject(injectable, {
      object: objectA,
    });
    const metricsForObjectB = di.inject(injectable, {
      object: objectB,
    });

    expect(metricsForObjectAAgain).toBe(metricsForObjectA);
    expect(metricsForObjectB).not.toBe(metricsForObjectA);
  });
});

describe("createTimeRangedMetricsInjectable polling a sliding window", () => {
  it("asks for the end of the window with the step of the whole window once it has the rest", async () => {
    const di = getDiForUnitTesting();
    const requests: { start: number; end: number; range: number; step?: number }[] = [];
    let now = 1_700_000_000;
    const injectable = createTimeRangedMetricsInjectable<{ object: TestObject }, TestObject, unknown>({
      id: "test-time-ranged-metrics-sliding",
      getObject: ({ object }) => object,
      getObjectId: (resource) => resource.getId(),
      request: async ({ start, end, range, step }) => {
        requests.push({ start, end, range, step });

        return {
          cpu: {
            status: "success",
            data: {
              resultType: "matrix",
              result: [
                {
                  metric: {},
                  values: Array.from({ length: Math.floor((end - start) / (step ?? 60)) + 1 }, (_, index) => [
                    start + index * (step ?? 60),
                    "1",
                  ]),
                },
              ],
            },
          },
        };
      },
    });

    di.register(injectable);
    di.override(
      selectedMetricsTimeRangeInjectable,
      () =>
        ({
          value: { get: () => ({ duration: 3600 }) },
          timestamps: { get: () => ({ start: now - 3600, end: now, range: 3600 }) },
        }) as never,
    );

    di.inject(injectable, { object: { getId: () => "sliding" } });
    const configuration = asyncComputedMock.mock.calls.at(-1)?.[0] as {
      getValueFromObservedPromise: () => Promise<unknown>;
    };

    await configuration.getValueFromObservedPromise();
    now += 60;
    await configuration.getValueFromObservedPromise();

    expect(requests[0]).toEqual({ start: 1_700_000_000 - 3600, end: 1_700_000_000, range: 3600, step: undefined });
    expect(requests[1].step).toBe(60);
    expect(requests[1].end).toBe(1_700_000_060);
    expect(requests[1].start).toBeGreaterThan(requests[0].start);
  });
});
