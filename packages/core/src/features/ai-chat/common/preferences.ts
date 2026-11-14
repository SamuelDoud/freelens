/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import {
  aiProviderEfforts,
  aiProviderIds,
  defaultAiProviderLabels,
  defaultAiProviderModels,
  isAiProviderId,
} from "./providers";

import type { AiProviderId } from "./providers";

/** Where the OpenAI-compatible server is: a Service reached through the cluster's API proxy, or a URL. */
export type AiOpenAiEndpoint =
  | { readonly kind: "service"; readonly namespace: string; readonly service: string; readonly port: string }
  | { readonly kind: "url"; readonly url: string };

export interface AiProviderPreferences {
  /** The models offered in the chat's model picker; empty offers only the backend's default. */
  readonly models: readonly string[];
  /** The model a new chat starts with; empty is the backend's default. */
  readonly defaultModel: string;
  /** The effort a new chat starts with; empty is the backend's default. */
  readonly defaultEffort: string;
}

export interface AiChatPreferences {
  /** The system prompt; empty uses the built-in one. */
  readonly systemPrompt: string;
  /** Ask for approval before each change even when the chat allows changes. */
  readonly askBeforeEachChange: boolean;
  readonly defaultProvider: AiProviderId;
  /** The `claude` and `codex` commands; empty finds them on the PATH. */
  readonly claudePath: string;
  readonly codexPath: string;
  /** The name shown for the OpenAI-compatible backend. */
  readonly openAiLabel: string;
  readonly openAiEndpoint: AiOpenAiEndpoint;
  readonly providers: Readonly<Record<AiProviderId, AiProviderPreferences>>;
}

export const defaultAiChatPreferences: AiChatPreferences = {
  systemPrompt: "",
  askBeforeEachChange: false,
  defaultProvider: "claude",
  claudePath: "",
  codexPath: "",
  openAiLabel: defaultAiProviderLabels.openai,
  openAiEndpoint: { kind: "service", namespace: "llm", service: "muse-glimmer-llamacpp", port: "8000" },
  providers: {
    claude: { models: defaultAiProviderModels.claude, defaultModel: "", defaultEffort: "" },
    codex: { models: defaultAiProviderModels.codex, defaultModel: "", defaultEffort: "" },
    openai: { models: defaultAiProviderModels.openai, defaultModel: "", defaultEffort: "" },
  },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readString = (value: unknown, fallback: string) => (typeof value === "string" ? value : fallback);

const readModels = (value: unknown, fallback: readonly string[]): readonly string[] =>
  Array.isArray(value)
    ? [
        ...new Set(value.filter((model): model is string => typeof model === "string").map((model) => model.trim())),
      ].filter(Boolean)
    : fallback;

const readEndpoint = (value: unknown): AiOpenAiEndpoint => {
  const fallback = defaultAiChatPreferences.openAiEndpoint;

  if (!isRecord(value)) {
    return fallback;
  }

  if (value.kind === "url") {
    return { kind: "url", url: readString(value.url, "") };
  }

  if (value.kind === "service" && fallback.kind === "service") {
    return {
      kind: "service",
      namespace: readString(value.namespace, fallback.namespace),
      service: readString(value.service, fallback.service),
      port: readString(value.port, fallback.port),
    };
  }

  return fallback;
};

const readProvider = (id: AiProviderId, value: unknown): AiProviderPreferences => {
  const fallback = defaultAiChatPreferences.providers[id];

  if (!isRecord(value)) {
    return fallback;
  }

  const defaultEffort = readString(value.defaultEffort, "");

  return {
    models: readModels(value.models, fallback.models),
    defaultModel: readString(value.defaultModel, "").trim(),
    defaultEffort: aiProviderEfforts[id].includes(defaultEffort) ? defaultEffort : "",
  };
};

/** The stored preferences, with anything missing or malformed replaced by its default. */
export function readAiChatPreferences(value: unknown): AiChatPreferences {
  if (!isRecord(value)) {
    return defaultAiChatPreferences;
  }

  const providers = isRecord(value.providers) ? value.providers : {};

  return {
    systemPrompt: readString(value.systemPrompt, ""),
    askBeforeEachChange: value.askBeforeEachChange === true,
    defaultProvider: isAiProviderId(value.defaultProvider)
      ? value.defaultProvider
      : defaultAiChatPreferences.defaultProvider,
    claudePath: readString(value.claudePath, "").trim(),
    codexPath: readString(value.codexPath, "").trim(),
    openAiLabel: readString(value.openAiLabel, "").trim() || defaultAiChatPreferences.openAiLabel,
    openAiEndpoint: readEndpoint(value.openAiEndpoint),
    providers: Object.fromEntries(aiProviderIds.map((id) => [id, readProvider(id, providers[id])])) as Record<
      AiProviderId,
      AiProviderPreferences
    >,
  };
}
