/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startFramesInOrder } from "./start-frames-in-order";

describe("startFramesInOrder", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("does not wait for the frame of a cluster that no longer exists", async () => {
    const started: string[] = [];
    const loaded = new Set<string>();
    const done = startFramesInOrder(
      ["gone", "alive"],
      {
        clusterFrames: {
          initView: (id: string) => {
            started.push(id);
            loaded.add(id);
          },
          hasLoadedView: (id: string) => loaded.has(id),
        },
        getClusterById: ((id: string) => (id === "alive" ? {} : undefined)) as never,
        requestClusterActivation: vi.fn(),
      },
      () => false,
      60_000,
    );

    await vi.advanceTimersByTimeAsync(1000);
    await done;

    expect(started).toEqual(["alive"]);
  });
});
