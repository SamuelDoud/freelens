/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { sendMessageToChannelInjectionToken } from "@freelensapp/messaging";
import { afterEach, describe, expect, it, vi } from "vitest";
import { historyGoChannel } from "../common/channels";
import mouseHistoryButtonsInjectable from "./mouse-history-buttons.injectable";

import type { DiContainerForInjection } from "@ogre-tools/injectable";

describe("mouse history buttons", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));

  const press = (url: string, button: number) => {
    window.history.replaceState(null, "", url);

    const send = vi.fn();
    const di = {
      inject: (injectable: unknown) => (injectable === sendMessageToChannelInjectionToken ? send : undefined),
    } as unknown as DiContainerForInjection;

    mouseHistoryButtonsInjectable.instantiate(di as never).run();
    window.dispatchEvent(new MouseEvent("mouseup", { button }));

    return send;
  };

  it("sends a step back for the back button", () => {
    expect(press("/", 3)).toHaveBeenCalledWith(historyGoChannel, -1);
  });

  it("does nothing in the window of an AI chat, whose step would move the other windows", () => {
    expect(press("/?ai-chat-window=abc", 3)).not.toHaveBeenCalled();
  });
});
