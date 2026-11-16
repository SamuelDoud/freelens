/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { autorun, observable, runInAction } from "mobx";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { throttledComputed } from "../throttled-computed";

describe("throttledComputed", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("computes on the spot when nothing observes it", () => {
    const source = observable.box(1);
    const compute = vi.fn(() => ({ value: source.get() }));
    const throttled = throttledComputed(compute, 1000);

    expect(throttled.get()).toEqual({ value: 1 });

    runInAction(() => source.set(2));

    expect(throttled.get()).toEqual({ value: 2 });
  });

  it("computes at most once per interval while observed, and ends on the latest data", () => {
    const source = observable.box(1);
    const compute = vi.fn(() => ({ value: source.get() }));
    const throttled = throttledComputed(compute, 1000);
    const seen: number[] = [];
    const dispose = autorun(() => seen.push(throttled.get().value));

    // the first value is computed for the observer, and the reaction that
    // tracks the data computes once more when the observer's batch ends
    expect(seen).toEqual([1]);
    expect(compute).toHaveBeenCalledTimes(2);

    for (let i = 2; i <= 50; i++) {
      runInAction(() => source.set(i));
      vi.advanceTimersByTime(10);
    }

    expect(compute).toHaveBeenCalledTimes(2);
    expect(seen).toEqual([1]);

    vi.advanceTimersByTime(1000);

    expect(compute).toHaveBeenCalledTimes(3);
    expect(seen).toEqual([1, 50]);

    for (let i = 51; i <= 100; i++) {
      runInAction(() => source.set(i));
      vi.advanceTimersByTime(10);
    }

    expect(compute).toHaveBeenCalledTimes(3);

    vi.advanceTimersByTime(1000);

    expect(compute).toHaveBeenCalledTimes(4);
    expect(seen).toEqual([1, 50, 100]);

    dispose();
    runInAction(() => source.set(101));
    vi.advanceTimersByTime(5000);

    expect(compute).toHaveBeenCalledTimes(4);
  });

  it("does not notify when the new value is structurally equal", () => {
    const source = observable.box(1);
    const throttled = throttledComputed(() => ({ even: source.get() % 2 === 0 }), 1000);
    const seen: boolean[] = [];

    autorun(() => seen.push(throttled.get().even));
    runInAction(() => source.set(3));
    vi.advanceTimersByTime(1000);
    runInAction(() => source.set(4));
    vi.advanceTimersByTime(1000);

    expect(seen).toEqual([false, true]);
  });
});
