/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import { asyncComputed } from "../../../common/utils/async-computed";
import selectedMetricsTimeRangeInjectable from "../cluster/overview/selected-metrics-time-range.injectable";
import { createIncrementalMetrics } from "./incremental-metrics";

import type { DiContainer, DiContainerForInjection, Injectable } from "@ogre-tools/injectable";

import type { IAsyncComputed, IReleasableAsyncComputed } from "../../../common/utils/async-computed";

interface RequestContext<ObjectType> {
  di: DiContainerForInjection;
  object: ObjectType;
  start: number;
  end: number;
  range: number;
  /** Set when only the end of the window is asked for: pass it on to the metrics API */
  step?: number;
}

interface TimeRangedMetricsInjectableConfig<Params, ObjectType, Value> {
  id: string;
  getObject: (params: Params) => ObjectType;
  getObjectId: (object: ObjectType) => string;
  request: (context: RequestContext<ObjectType>) => Promise<Value>;
}

type TimeRangedMetricsInjectable<Params, Value> = Injectable<IAsyncComputed<Value>, IAsyncComputed<Value>, Params>;

const getTimeRangedMetricsInjectable = getInjectable as <Params, Value>(options: {
  id: string;
  instantiate: (di: DiContainerForInjection, params: Params) => IAsyncComputed<Value>;
  lifecycle: {
    getInstanceKey: (di: DiContainer, params: Params) => string;
  };
}) => TimeRangedMetricsInjectable<Params, Value>;

/**
 * How many objects, over all the kinds, keep the metrics they last fetched.
 * Every object whose metrics were opened keeps an instance with its response
 * (about 50 to 90 KB at one hour) for the whole session; this bounds that to the
 * objects used most recently, which a visit back to a recent object still finds,
 * and the rest fetch again when they are opened.
 */
export const maxObjectsWithCachedMetrics = 64;

const recentlyUsed = new Set<string>();
const releasers = new Map<string, () => void>();

/**
 * Notes that an object's metrics are in use, and releases those of the objects
 * used least recently when there are more than `maxObjectsWithCachedMetrics`.
 */
function markUsed(key: string): void {
  recentlyUsed.delete(key);
  recentlyUsed.add(key);

  for (const oldest of recentlyUsed) {
    if (recentlyUsed.size <= maxObjectsWithCachedMetrics) {
      break;
    }

    recentlyUsed.delete(oldest);
    releasers.get(oldest)?.();
  }
}

export const createTimeRangedMetricsInjectable = <Params, ObjectType, Value>({
  id,
  getObject,
  getObjectId,
  request,
}: TimeRangedMetricsInjectableConfig<Params, ObjectType, Value>): TimeRangedMetricsInjectable<Params, Value> =>
  getTimeRangedMetricsInjectable<Params, Value>({
    id,
    instantiate: (di, params) => {
      const selectedMetricsTimeRange = di.inject(selectedMetricsTimeRangeInjectable);
      const object = getObject(params);
      const key = `${id}:${getObjectId(object)}`;

      // Every poll of a sliding window asks for the end of it only, and the
      // points before are kept (see `createIncrementalMetrics`).
      const incremental = createIncrementalMetrics<Record<string, never>>({
        request: ({ start, end, range, step }) =>
          request({ di, object, start, end, range, step }) as Promise<Record<string, never>>,
      });

      const metrics: IReleasableAsyncComputed<Value> = asyncComputed<Value>({
        getValueFromObservedPromise: async () => {
          const { start, end, range } = selectedMetricsTimeRange.timestamps.get();

          return incremental.fetch({
            start,
            end,
            range,
            sliding: selectedMetricsTimeRange.value.get().duration != null,
          }) as Promise<Value>;
        },
        betweenUpdates: "show-latest-value",
      });

      releasers.set(key, () => {
        incremental.reset();
        metrics.release();
      });

      return metrics;
    },
    lifecycle: lifecycleEnum.keyedSingleton({
      // Asked for at every injection, which is every use of the metrics.
      getInstanceKey: (_di, params) => {
        const objectId = getObjectId(getObject(params));

        markUsed(`${id}:${objectId}`);

        return objectId;
      },
    }),
  });
