/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it, vi } from "vitest";
import { getDiForUnitTesting } from "../../getDiForUnitTesting";
import { renderFor } from "../test-utils/renderFor";
import { MenuActions } from "./menu-actions";
import { releasedMenuControls } from "./released-menu-controls";

import type { MenuControls } from "./menu-actions";

describe("MenuActions", () => {
  it("hands its controls to onMenuReady on mounting, and the released controls on unmounting", () => {
    const onMenuReady = vi.fn<(controls: MenuControls) => void>();
    const { unmount } = renderFor(getDiForUnitTesting())(<MenuActions id="some-menu" onMenuReady={onMenuReady} />);

    expect(onMenuReady).toHaveBeenCalledTimes(1);
    expect(onMenuReady.mock.calls[0][0]).not.toBe(releasedMenuControls);

    unmount();

    expect(onMenuReady).toHaveBeenCalledTimes(2);
    expect(onMenuReady.mock.calls[1][0]).toBe(releasedMenuControls);
  });
});
