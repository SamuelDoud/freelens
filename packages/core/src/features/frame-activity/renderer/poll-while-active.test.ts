/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { computed, observable, runInAction } from "mobx";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pollWhileActive } from "./poll-while-active";

describe("pollWhileActive", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("polls while active, pauses while not, and catches up when active again", () => {
    const active = observable.box(true);
    const poll = vi.fn();
    const stop = pollWhileActive(
      computed(() => active.get()),
      10,
      poll,
    );

    expect(poll).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(20_000);
    expect(poll).toHaveBeenCalledTimes(3);

    runInAction(() => active.set(false));
    vi.advanceTimersByTime(60_000);
    expect(poll).toHaveBeenCalledTimes(3);

    runInAction(() => active.set(true));
    expect(poll).toHaveBeenCalledTimes(4);

    stop();
    vi.advanceTimersByTime(60_000);
    expect(poll).toHaveBeenCalledTimes(4);
  });
});
