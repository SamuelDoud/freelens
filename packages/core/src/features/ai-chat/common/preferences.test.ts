/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { defaultAiChatPreferences, readAiChatPreferences } from "./preferences";

describe("readAiChatPreferences", () => {
  it("gives the defaults for nothing stored, with approval of each change off", () => {
    expect(readAiChatPreferences(undefined)).toEqual(defaultAiChatPreferences);
    expect(defaultAiChatPreferences.askBeforeEachChange).toBe(false);
  });

  it("keeps valid values and drops malformed ones", () => {
    const preferences = readAiChatPreferences({
      systemPrompt: "Be brief.",
      askBeforeEachChange: true,
      defaultProvider: "codex",
      claudePath: " /opt/claude ",
      openAiEndpoint: { kind: "url", url: "http://muse:8000" },
      providers: {
        claude: { models: ["opus", " opus ", "", 3, "sonnet"], defaultModel: "opus", defaultEffort: "max" },
        codex: { models: "not a list", defaultEffort: "ultra" },
      },
    });

    expect(preferences.systemPrompt).toBe("Be brief.");
    expect(preferences.askBeforeEachChange).toBe(true);
    expect(preferences.defaultProvider).toBe("codex");
    expect(preferences.claudePath).toBe("/opt/claude");
    expect(preferences.openAiEndpoint).toEqual({ kind: "url", url: "http://muse:8000" });
    expect(preferences.providers.claude).toEqual({
      models: ["opus", "sonnet"],
      defaultModel: "opus",
      defaultEffort: "max",
    });
    expect(preferences.providers.codex).toEqual({ models: [], defaultModel: "", defaultEffort: "" });
    expect(preferences.providers.openai).toEqual(defaultAiChatPreferences.providers.openai);
  });

  it("falls back on an unknown provider and endpoint", () => {
    const preferences = readAiChatPreferences({ defaultProvider: "gpt", openAiEndpoint: { kind: "ftp" } });

    expect(preferences.defaultProvider).toBe("claude");
    expect(preferences.openAiEndpoint).toEqual(defaultAiChatPreferences.openAiEndpoint);
  });
});
