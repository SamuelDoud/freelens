/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observable, reaction } from "mobx";
import { describe, expect, it, vi } from "vitest";
import currentlyInClusterFrameInjectable from "../../../renderer/routes/currently-in-cluster-frame.injectable";
import clusterFramePressedListenerInjectable from "./cluster-frame-pressed-listener.injectable";
import pressedClusterFrameInjectable from "./pressed-cluster-frame.injectable";

import type { DiContainerForInjection } from "@ogre-tools/injectable";

describe("cluster frame pressed listener", () => {
  it("notifies on every press, also when the same frame is pressed again", () => {
    const pressed = observable.box<string | undefined>(undefined, { deep: false });
    const di = {
      inject: (injectable: unknown) =>
        injectable === currentlyInClusterFrameInjectable
          ? false
          : injectable === pressedClusterFrameInjectable
            ? pressed
            : undefined,
    } as unknown as DiContainerForInjection;
    const { handler } = clusterFramePressedListenerInjectable.instantiate(di as never);
    const seen = vi.fn();

    reaction(
      () => pressed.get(),
      (id) => id && seen(id),
    );

    handler("a");
    handler("a");

    expect(seen).toHaveBeenCalledTimes(2);
  });
});
