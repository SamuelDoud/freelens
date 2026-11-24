/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { ResizeDirection, ResizeGrowthDirection, ResizeSide, ResizingAnchor } from "./resizing-anchor";

import type React from "react";

const mouse = (pageX: number) => ({ pageX, pageY: 0, buttons: 1 }) as unknown as MouseEvent;

describe("ResizingAnchor", () => {
  it("delivers the last movement before onEnd, when the throttle still holds it", () => {
    const calls: string[] = [];
    let extent = 400;
    const anchor = new ResizingAnchor({
      ...ResizingAnchor.defaultProps,
      direction: ResizeDirection.HORIZONTAL,
      placement: ResizeSide.LEADING,
      growthDirection: ResizeGrowthDirection.LEFT_TO_RIGHT,
      getCurrentExtent: () => extent,
      onDrag: (next: number) => {
        extent = next;
        calls.push(`drag ${next}`);
      },
      onEnd: () => calls.push(`end ${extent}`),
    });

    // The bar sits left of every move, so no move counts as the bar jumping around.
    // The drag handlers are the anchor's own: the test drives them as the DOM events would.
    const internals = anchor as unknown as {
      ref: React.MutableRefObject<HTMLDivElement | null>;
      onDragInit: (event: React.MouseEvent) => void;
      onDrag: (event: MouseEvent) => void;
      onDragEnd: () => void;
    };

    internals.ref.current = {
      getBoundingClientRect: () => ({ x: 0, y: 0, width: 4, height: 100 }),
    } as HTMLDivElement;

    internals.onDragInit({ buttons: 1 } as React.MouseEvent);
    // Within one throttle window: the first move runs at once and only records the position; the
    // later ones wait in the throttle.
    internals.onDrag(mouse(100));
    internals.onDrag(mouse(110));
    internals.onDrag(mouse(130));
    internals.onDragEnd();

    // The movement reaches onDrag before onEnd, and onEnd sees the extent it set.
    expect(extent).not.toBe(400);
    expect(calls.slice(-2)).toEqual([`drag ${extent}`, `end ${extent}`]);
    anchor.componentWillUnmount();
  });
});
