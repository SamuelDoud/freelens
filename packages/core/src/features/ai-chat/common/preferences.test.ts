/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { defaultAiChatPreferences, isOpenAiConfigured, readAiChatPreferences } from "./preferences";

describe("readAiChatPreferences", () => {
  it("gives defaults that assume nothing about the user's setup", () => {
    const preferences = readAiChatPreferences(undefined);

    expect(preferences).toEqual(defaultAiChatPreferences);
    expect(preferences.askBeforeEachChange).toBe(false);
    expect(preferences.openAiEndpoint).toEqual({ kind: "none" });
    expect(preferences.openAiLabel).toBe("OpenAI-compatible server");
    expect(isOpenAiConfigured(preferences)).toBe(false);
    expect(preferences.placement).toBe("bottom");
    expect(preferences.discovered).toBe(false);
  });

  it("drops the defaults 2.2 shipped for its author's own model server", () => {
    const preferences = readAiChatPreferences({
      openAiLabel: "Muse",
      openAiEndpoint: { kind: "service", namespace: "llm", service: "muse-glimmer-llamacpp", port: "8000" },
      providers: { claude: { models: ["opus", "sonnet", "haiku"], defaultModel: "opus" } },
    });

    expect(preferences.openAiLabel).toBe("OpenAI-compatible server");
    expect(preferences.openAiEndpoint).toEqual({ kind: "none" });
    expect(preferences.providers.claude).toEqual({ defaultModel: "opus", defaultEffort: "", extraModels: [] });
  });

  it("keeps a server the user set up", () => {
    const preferences = readAiChatPreferences({
      openAiLabel: "Team vLLM",
      openAiEndpoint: { kind: "service", namespace: "ai", service: "vllm", port: "8000" },
      providers: { openai: { extraModels: ["qwen", " qwen ", "llama"] } },
    });

    expect(preferences.openAiLabel).toBe("Team vLLM");
    expect(preferences.openAiEndpoint).toEqual({ kind: "service", namespace: "ai", service: "vllm", port: "8000" });
    expect(isOpenAiConfigured(preferences)).toBe(true);
    expect(preferences.providers.openai.extraModels).toEqual(["qwen", "llama"]);
  });

  it("keeps valid choices and drops malformed ones", () => {
    const preferences = readAiChatPreferences({
      defaultProvider: "muse",
      musePath: " /usr/local/bin/muse ",
      placement: "window",
      discovered: true,
      rightPanelWidth: 99999,
    });

    expect(preferences.defaultProvider).toBe("muse");
    expect(preferences.musePath).toBe("/usr/local/bin/muse");
    expect(preferences.placement).toBe("window");
    expect(preferences.discovered).toBe(true);
    expect(preferences.rightPanelWidth).toBe(1600);
    expect(readAiChatPreferences({ defaultProvider: "gpt", placement: "left" }).defaultProvider).toBe("claude");
    expect(readAiChatPreferences({ placement: "left" }).placement).toBe("bottom");
  });
});
