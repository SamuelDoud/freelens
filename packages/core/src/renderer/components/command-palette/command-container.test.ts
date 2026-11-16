/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { computed } from "mobx";
import { describe, expect, it, vi } from "vitest";
import { getOpenCommandPalette } from "./command-container";

describe("getOpenCommandPalette", () => {
  it("asks the frame of the shown cluster, by its id, to open its palette", () => {
    const broadcast = vi.fn();
    const openHere = vi.fn();

    getOpenCommandPalette({
      clusterId: undefined,
      matchedClusterId: computed(() => "cluster-1"),
      openHere,
      broadcast,
    })();

    expect(broadcast).toHaveBeenCalledWith("command-palette:cluster-1:open");
    expect(openHere).not.toHaveBeenCalled();
  });
});
