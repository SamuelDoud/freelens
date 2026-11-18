/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "@testing-library/jest-dom/vitest";

import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Badge } from "./badge";

const overflow = (scrollWidth: number, clientWidth: number) => {
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(scrollWidth);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(clientWidth);
};

describe("<Badge>", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows its label and children", () => {
    const { getByText } = render(
      <Badge label="label" data-testid="badge">
        child
      </Badge>,
    );

    expect(getByText(/label/)).toHaveTextContent("labelchild");
  });

  it("is clickable when it has a click handler", () => {
    const onClick = vi.fn();
    const { getByTestId } = render(<Badge label="x" data-testid="badge" onClick={onClick} />);

    expect(getByTestId("badge").className).toMatch(/clickable/);
    fireEvent.click(getByTestId("badge"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("expands on mouse up when its content overflows, and collapses on the next", () => {
    overflow(200, 100);

    const { getByTestId } = render(<Badge label="long" data-testid="badge" />);
    const badge = getByTestId("badge");

    expect(badge.className).toMatch(/interactive/);
    expect(badge.className).not.toMatch(/isExpanded/);

    act(() => {
      fireEvent.mouseUp(badge);
    });
    expect(badge.className).toMatch(/isExpanded/);

    act(() => {
      fireEvent.mouseUp(badge);
    });
    expect(badge.className).not.toMatch(/isExpanded/);
  });

  it("does not expand when it does not overflow, or when it is not expandable", () => {
    overflow(100, 100);

    const fits = render(<Badge label="short" data-testid="fits" />);

    act(() => {
      fireEvent.mouseUp(fits.getByTestId("fits"));
    });
    expect(fits.getByTestId("fits").className).not.toMatch(/isExpanded|interactive/);

    overflow(200, 100);

    const fixed = render(<Badge label="long" expandable={false} data-testid="fixed" />);

    act(() => {
      fireEvent.mouseUp(fixed.getByTestId("fixed"));
    });
    expect(fixed.getByTestId("fixed").className).not.toMatch(/isExpanded|interactive/);
  });
});
