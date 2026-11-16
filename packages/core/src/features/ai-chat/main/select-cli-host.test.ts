/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it, vi } from "vitest";
import { defaultAiChatPreferences } from "../common/preferences";
import { createCliHostSelector } from "./select-cli-host";

import type { AiChatPreferences } from "../common/preferences";
import type { AiCliHost } from "./cli-host";

const fakeHost = () => ({ close: vi.fn() }) as unknown as AiCliHost;

describe("createCliHostSelector", () => {
  it("closes the connection when the preference goes back to this computer", () => {
    const local = fakeHost();
    const remoteHost = fakeHost();
    let preferences: AiChatPreferences = {
      ...defaultAiChatPreferences,
      remoteHost: { ...defaultAiChatPreferences.remoteHost, enabled: true, destination: "dev" },
    };
    const select = createCliHostSelector({ preferences: () => preferences, local, createRemote: () => remoteHost });

    expect(select()).toBe(remoteHost);
    expect(select()).toBe(remoteHost);
    expect(remoteHost.close).not.toHaveBeenCalled();

    preferences = { ...preferences, remoteHost: { ...preferences.remoteHost, enabled: false } };

    expect(select()).toBe(local);
    expect(remoteHost.close).toHaveBeenCalledTimes(1);
  });
});
