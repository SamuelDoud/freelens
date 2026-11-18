/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it, vi } from "vitest";
import { FrameLiveness } from "./frame-liveness";

const setup = () => {
  const frames = new Map([
    ["a", { frameId: 4, processId: 6 }],
    ["b", { frameId: 4, processId: 7 }],
  ]);
  const gone = new Set<number>();
  const onGone = vi.fn();
  const liveness = new FrameLiveness({
    getFrames: () => frames.entries(),
    isAlive: ({ processId }) => !gone.has(processId),
    forget: (clusterId) => frames.delete(clusterId),
    onGone,
  });

  return { frames, gone, onGone, liveness };
};

describe("FrameLiveness", () => {
  it("reports nothing while every frame is there", () => {
    const { liveness, onGone } = setup();

    liveness.check();
    liveness.check();

    expect(onGone).not.toHaveBeenCalled();
  });

  it("reports a frame gone, once, on the second check, and forgets it", () => {
    const { liveness, onGone, gone, frames } = setup();

    gone.add(7);
    liveness.check();
    expect(onGone).not.toHaveBeenCalled();

    liveness.check();
    expect(onGone).toHaveBeenCalledExactlyOnceWith("b");
    expect(frames.has("b")).toBe(false);

    liveness.check();
    liveness.check();
    expect(onGone).toHaveBeenCalledTimes(1);
  });

  it("does not report a frame that was replaced between the checks", () => {
    const { liveness, onGone, gone, frames } = setup();

    gone.add(7);
    liveness.check();
    frames.set("b", { frameId: 9, processId: 8 });
    liveness.check();
    liveness.check();

    expect(onGone).not.toHaveBeenCalled();
  });

  it("does not report a frame that came back, or one taken out meanwhile", () => {
    const { liveness, onGone, gone, frames } = setup();

    gone.add(6);
    gone.add(7);
    liveness.check();
    gone.delete(6);
    frames.delete("b");
    liveness.check();
    liveness.check();

    expect(onGone).not.toHaveBeenCalled();
  });
});
