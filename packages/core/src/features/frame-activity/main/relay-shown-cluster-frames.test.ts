/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { sendMessageToChannelInjectionToken } from "@freelensapp/messaging";
import { describe, expect, it, vi } from "vitest";
import { shownClusterFramesChannel } from "../common/channels";
import lastShownClusterFramesInjectable from "./last-shown-cluster-frames.injectable";
import relayShownClusterFramesInjectable from "./relay-shown-cluster-frames.injectable";
import replayShownClusterFramesInjectable from "./replay-shown-cluster-frames.injectable";

import type { DiContainerForInjection } from "@ogre-tools/injectable";

describe("shown cluster frames for frames that start later", () => {
  it("replays the last value a frame started after it was said", () => {
    const send = vi.fn();
    const last = { clusterIds: undefined as string[] | undefined };
    const di = {
      inject: (injectable: unknown) =>
        injectable === sendMessageToChannelInjectionToken
          ? send
          : injectable === lastShownClusterFramesInjectable
            ? last
            : undefined,
    } as unknown as DiContainerForInjection;
    const relay = relayShownClusterFramesInjectable.instantiate(di as never);
    const replay = replayShownClusterFramesInjectable.instantiate(di as never);

    replay.handler();
    expect(send).not.toHaveBeenCalled();

    relay.handler(["a"]);
    send.mockClear();
    replay.handler();

    expect(send).toHaveBeenCalledWith(shownClusterFramesChannel, ["a"]);
  });
});
