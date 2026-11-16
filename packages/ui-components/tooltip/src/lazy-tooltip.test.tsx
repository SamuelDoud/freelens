/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Tooltip } from "./tooltip";

import type { MockInstance } from "vitest";
import "@testing-library/jest-dom/vitest";

describe("<Tooltip /> mounted on first hover", () => {
  let frames: FrameRequestCallback[];
  let rafSpy: MockInstance<(callback: FrameRequestCallback) => number>;

  beforeEach(() => {
    frames = [];
    rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => frames.push(cb));
  });

  afterEach(() => rafSpy.mockRestore());

  const runFrames = () =>
    act(() => {
      frames.splice(0).forEach((cb) => cb(0));
    });

  it("renders nothing until the target is hovered, then shows, hides and shows again", () => {
    const result = render(
      <div>
        <Tooltip targetId="target" usePortal={false}>
          tip
        </Tooltip>
        <div id="target">target</div>
      </div>,
    );
    const target = result.container.querySelector("#target")!;

    expect(result.queryByRole("tooltip")).toBeNull();

    fireEvent.mouseEnter(target);
    expect(result.getByRole("tooltip")).toHaveTextContent("tip");
    expect(result.getByRole("tooltip")).not.toHaveClass("visible");

    runFrames();
    expect(result.getByRole("tooltip")).toHaveClass("Tooltip", "visible");

    fireEvent.mouseLeave(target);
    expect(result.queryByRole("tooltip")).toBeNull();

    fireEvent.mouseEnter(target);
    runFrames();
    expect(result.getByRole("tooltip")).toHaveClass("visible");
  });

  it("follows the parent of the target when asked to", () => {
    const result = render(
      <div id="parent">
        <Tooltip targetId="target" usePortal={false} tooltipOnParentHover>
          tip
        </Tooltip>
        <div id="target">target</div>
      </div>,
    );

    fireEvent.mouseEnter(result.container.querySelector("#target")!);
    expect(result.queryByRole("tooltip")).toBeNull();

    fireEvent.mouseEnter(result.container.querySelector("#parent")!);
    expect(result.getByRole("tooltip")).toBeInTheDocument();
  });

  it("shows at once when visible is set", () => {
    const result = render(
      <div>
        <Tooltip targetId="target" usePortal={false} visible>
          tip
        </Tooltip>
        <div id="target">target</div>
      </div>,
    );

    expect(result.getByRole("tooltip")).toHaveClass("visible");
  });

  it("removes its listener from the target when unmounted before any hover", () => {
    const target = document.createElement("div");

    target.id = "target";
    document.body.appendChild(target);

    const add = vi.spyOn(target, "addEventListener");
    const remove = vi.spyOn(target, "removeEventListener");
    const result = render(<Tooltip targetId="target">tip</Tooltip>);

    expect(add).toHaveBeenCalledWith("mouseenter", expect.any(Function));
    result.unmount();
    expect(remove).toHaveBeenCalledWith("mouseenter", add.mock.calls[0][1]);
    target.remove();
  });
});
