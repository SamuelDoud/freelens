/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { calculateAdaptiveStep } from "../../../common/k8s-api/endpoints/metrics.api/adaptive-step";
import { createIncrementalMetrics } from "./incremental-metrics";

import type { MetricData } from "../../../common/k8s-api/endpoints/metrics.api";
import type { IncrementalWindow, MetricSet } from "./incremental-metrics";

/**
 * A Prometheus that serves deterministic series: the value of a point is a
 * function of its series and its timestamp only, as in PromQL, where an
 * instant is evaluated on its own whatever the range around it.
 */
class FakePrometheus {
  /** series name -> first timestamp it has samples at */
  births = new Map<string, number>([
    ["a", 0],
    ["b", 0],
  ]);
  /** Added to every value at or after a timestamp: a late sample revising history */
  revisions: { from: number; delta: number }[] = [];
  calls: { start: number; end: number; step: number; points: number }[] = [];

  value(name: string, timestamp: number): string {
    let value = ((timestamp * 2654435761) % 1000) / 10 + (name === "a" ? 0 : 500);

    for (const revision of this.revisions) {
      if (timestamp >= revision.from) {
        value += revision.delta;
      }
    }

    return String(value);
  }

  query = async (window: IncrementalWindow): Promise<MetricSet> => {
    const { metrics, step, points } = this.peek(window);

    this.calls.push({ start: window.start, end: window.end, step, points });

    return metrics;
  };

  /** The answer, without counting it as a request */
  peek({ start, end, step }: IncrementalWindow) {
    // What `requestMetrics` does: the step comes from the window unless it is given.
    const actualStep = step ?? calculateAdaptiveStep(end - start);
    const metrics: MetricSet = {};
    let points = 0;

    for (const metricName of ["cpu", "mem"]) {
      const result = [];

      for (const [name, birth] of this.births) {
        const values: [number, string][] = [];

        for (let timestamp = start; timestamp <= end; timestamp += actualStep) {
          if (timestamp >= birth) {
            values.push([timestamp, `${metricName}${this.value(name, timestamp)}`]);
          }
        }

        points += values.length;

        if (values.length > 0) {
          result.push({ metric: { pod: name }, values });
        }
      }

      metrics[metricName] = { status: "success", data: { resultType: "matrix", result } } as MetricData;
    }

    return { metrics, step: actualStep, points };
  }
}

/** What a single request for the window gives, from the first grid point at or after `start`. */
const wholeWindowFrom = (prometheus: FakePrometheus, anchor: number, start: number, end: number) => {
  const step = calculateAdaptiveStep(end - start);
  const snapped = anchor + Math.ceil((start - anchor) / step) * step;

  return prometheus.peek({ start: snapped, end, range: end - snapped, step }).metrics;
};

const durations = [300, 3600, 4 * 3600, 24 * 3600];

describe("createIncrementalMetrics", () => {
  for (const duration of durations) {
    it(`gives the points of one request from the grid, for a window of ${duration}s polled every minute`, async () => {
      const prometheus = new FakePrometheus();
      const incremental = createIncrementalMetrics({ request: prometheus.query });
      const startedAt = 1_700_000_000;
      let now = startedAt;

      for (let poll = 0; poll < 60; poll += 1) {
        const result = await incremental.fetch({ start: now - duration, end: now, range: duration, sliding: true });
        const expected = wholeWindowFrom(prometheus, startedAt - duration, now - duration, now);

        expect(result).toEqual(expected);
        now += 60;
      }
    });
  }

  it("gives exactly the points of the request it replaces when the step divides the poll interval", async () => {
    const prometheus = new FakePrometheus();
    const incremental = createIncrementalMetrics({ request: prometheus.query });
    const reference = new FakePrometheus();
    let now = 1_700_000_000;

    for (let poll = 0; poll < 40; poll += 1) {
      const result = await incremental.fetch({ start: now - 3600, end: now, range: 3600, sliding: true });

      expect(result).toEqual(reference.peek({ start: now - 3600, end: now, range: 3600 }).metrics);
      now += 60;
    }
  });

  it("gives points that are values of the request it replaces at the same timestamps when the grid moves", async () => {
    const prometheus = new FakePrometheus();
    const incremental = createIncrementalMetrics({ request: prometheus.query });
    const reference = new FakePrometheus();
    let now = 1_700_000_000;

    for (let poll = 0; poll < 40; poll += 1) {
      const result = await incremental.fetch({ start: now - 86400, end: now, range: 86400, sliding: true });
      const whole = reference.peek({ start: now - 86400, end: now, range: 86400 }).metrics;

      for (const key of ["cpu", "mem"]) {
        const [mine] = result[key]!.data.result;
        const [theirs] = whole[key]!.data.result;
        const byTimestamp = new Map(theirs.values);

        expect(mine.values.length).toBeGreaterThanOrEqual(theirs.values.length - 1);
        expect(mine.values.length).toBeLessThanOrEqual(theirs.values.length);

        // Same value wherever both have the timestamp; here the grids differ by a fixed offset, so
        // compare against the model of the series instead.
        for (const [timestamp, value] of mine.values) {
          expect(value).toBe(`${key}${prometheus.value("a", timestamp)}`);
          expect(byTimestamp.get(timestamp) ?? value).toBe(value);
        }

        expect(mine.values[0][0]).toBeGreaterThanOrEqual(now - 86400);
        expect(mine.values[mine.values.length - 1][0]).toBeGreaterThan(now - 600);
      }

      now += 60;
    }
  });

  it("asks only for the end of the window once it has the rest", async () => {
    const prometheus = new FakePrometheus();
    const incremental = createIncrementalMetrics({ request: prometheus.query });
    let now = 1_700_000_000;

    for (let poll = 0; poll < 5; poll += 1) {
      await incremental.fetch({ start: now - 3600, end: now, range: 3600, sliding: true });
      now += 60;
    }

    expect(prometheus.calls[0].points).toBe(2 * 2 * 61);
    expect(prometheus.calls.slice(1).every((call) => call.points <= 2 * 2 * 9)).toBe(true);
    expect(prometheus.calls.slice(1).every((call) => call.step === 60)).toBe(true);
  });

  it("fetches the whole window again every N polls and picks up revised history", async () => {
    const prometheus = new FakePrometheus();
    const incremental = createIncrementalMetrics({ request: prometheus.query, fullRefetchEvery: 5 });
    const start = 1_700_000_000;
    let now = start;

    for (let poll = 0; poll < 5; poll += 1) {
      await incremental.fetch({ start: now - 3600, end: now, range: 3600, sliding: true });
      now += 60;
    }

    // History far outside the overlap changes; the incremental polls cannot see it...
    prometheus.revisions.push({ from: now - 3000, delta: 1 });
    const stale = await incremental.fetch({ start: now - 3600, end: now, range: 3600, sliding: true });

    // ...but the sixth fetch, the first of the next cycle of five, asks for the whole window.
    expect(prometheus.calls[prometheus.calls.length - 1].points).toBe(2 * 2 * 61);

    const fresh = wholeWindowFrom(prometheus, start - 3600, now - 3600, now);

    expect(stale).toEqual(fresh);
  });

  it("picks up a late sample within the overlap", async () => {
    const prometheus = new FakePrometheus();
    const incremental = createIncrementalMetrics({ request: prometheus.query });
    let now = 1_700_000_000;

    await incremental.fetch({ start: now - 3600, end: now, range: 3600, sliding: true });
    now += 60;
    prometheus.revisions.push({ from: now - 120, delta: 7 });

    const result = await incremental.fetch({ start: now - 3600, end: now, range: 3600, sliding: true });

    expect(result).toEqual(wholeWindowFrom(prometheus, 1_700_000_000 - 3600, now - 3600, now));
  });

  it("fetches the whole window when a series appears", async () => {
    const prometheus = new FakePrometheus();
    const incremental = createIncrementalMetrics({ request: prometheus.query });
    let now = 1_700_000_000;

    await incremental.fetch({ start: now - 3600, end: now, range: 3600, sliding: true });
    now += 60;
    prometheus.births.set("c", now - 1800);

    const result = await incremental.fetch({ start: now - 3600, end: now, range: 3600, sliding: true });

    expect(result.cpu!.data.result.map((series) => series.metric.pod)).toEqual(["a", "b", "c"]);
    expect(result.cpu!.data.result[2].values[0][0]).toBeGreaterThanOrEqual(now - 1800);
    // The whole window was asked for again.
    expect(prometheus.calls.at(-1)).toMatchObject({ start: now - 3600, end: now });
  });

  it("fetches the whole window when the range or the key changes", async () => {
    const prometheus = new FakePrometheus();
    const incremental = createIncrementalMetrics({ request: prometheus.query });
    const now = 1_700_000_000;

    await incremental.fetch({ start: now - 3600, end: now, range: 3600, sliding: true });
    await incremental.fetch({ start: now + 60 - 14400, end: now + 60, range: 14400, sliding: true });
    expect(prometheus.calls.at(-1)).toMatchObject({ start: now + 60 - 14400, end: now + 60 });

    await incremental.fetch({ start: now + 120 - 14400, end: now + 120, range: 14400, sliding: true, key: "x" });
    expect(prometheus.calls.at(-1)).toMatchObject({ start: now + 120 - 14400 });
  });

  it("does not hold what a custom range fetched", async () => {
    const prometheus = new FakePrometheus();
    const incremental = createIncrementalMetrics({ request: prometheus.query });
    const params = { start: 1_700_000_000, end: 1_700_003_600, range: 3600, sliding: false };

    await incremental.fetch(params);
    await incremental.fetch(params);

    expect(prometheus.calls.map((call) => call.points)).toEqual([2 * 2 * 61, 2 * 2 * 61]);
  });

  it("is equal to the whole window under random polls, births and windows", async () => {
    let seed = 12345;
    const random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;

      return seed / 0x7fffffff;
    };

    for (let run = 0; run < 30; run += 1) {
      const prometheus = new FakePrometheus();
      const incremental = createIncrementalMetrics({
        request: prometheus.query,
        fullRefetchEvery: 2 + Math.floor(random() * 8),
      });
      const duration = durations[Math.floor(random() * durations.length)];
      let now = 1_700_000_000;
      let anchor = now - duration;

      for (let poll = 0; poll < 60; poll += 1) {
        if (random() < 0.08) {
          prometheus.births.set(`n${poll}`, now - Math.floor(random() * duration));
        }

        const before = prometheus.calls.length;
        const result = await incremental.fetch({ start: now - duration, end: now, range: duration, sliding: true });

        // The anchor moves whenever the whole window was fetched.
        if (prometheus.calls.slice(before).some((call) => call.start === now - duration)) {
          anchor = now - duration;
        }

        expect(result).toEqual(wholeWindowFrom(prometheus, anchor, now - duration, now));
        now += 30 + Math.floor(random() * 60);
      }
    }
  });
});
