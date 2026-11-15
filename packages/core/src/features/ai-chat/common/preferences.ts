/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { aiProviderIds, isAiProviderId } from "./providers";

import type { AiProviderId } from "./providers";

/** Where the OpenAI-compatible server is: nowhere until the user sets it, a Service, or a URL. */
export type AiOpenAiEndpoint =
  | { readonly kind: "none" }
  | { readonly kind: "service"; readonly namespace: string; readonly service: string; readonly port: string }
  | { readonly kind: "url"; readonly url: string };

/** Where a chat shows: in the bottom dock, in a panel at the right of the cluster view, or in a window. */
export type AiChatPlacement = "bottom" | "right" | "window";

export const aiChatPlacements: readonly AiChatPlacement[] = ["bottom", "right", "window"];

export interface AiProviderPreferences {
  /** The model a new chat starts with; empty is the backend's default. */
  readonly defaultModel: string;
  /** The effort a new chat starts with; empty is the backend's default. */
  readonly defaultEffort: string;
  /** Models to offer besides the ones the backend reports (the OpenAI-compatible server's own list). */
  readonly extraModels: readonly string[];
}

/**
 * Another host the CLIs run on, over SSH: where Claude Code, Codex or Muse are installed and
 * signed in, such as a development machine. Empty fields leave it to the user's SSH configuration.
 */
export interface AiRemoteHost {
  readonly enabled: boolean;
  /** A DNS name, an address or an alias of the SSH configuration, with or without "user@" */
  readonly destination: string;
  readonly port: string;
  /** A private key to use, instead of the SSH agent's and configuration's */
  readonly identityFile: string;
  /** An SSH configuration file to use instead of ~/.ssh/config */
  readonly configFile: string;
}

export const defaultAiRemoteHost: AiRemoteHost = {
  enabled: false,
  destination: "",
  port: "",
  identityFile: "",
  configFile: "",
};

/** Whether the CLIs run on another host */
export const usesRemoteHost = ({ remoteHost }: AiChatPreferences) =>
  remoteHost.enabled && remoteHost.destination.trim() !== "";

export interface AiChatPreferences {
  /** The system prompt; empty uses the built-in one. */
  readonly systemPrompt: string;
  /** Ask for approval before each change even when the chat allows changes. */
  readonly askBeforeEachChange: boolean;
  readonly defaultProvider: AiProviderId;
  /** The commands of the CLIs; empty finds them on the PATH. */
  readonly claudePath: string;
  readonly codexPath: string;
  readonly musePath: string;
  readonly openAiLabel: string;
  readonly openAiEndpoint: AiOpenAiEndpoint;
  readonly providers: Readonly<Record<AiProviderId, AiProviderPreferences>>;
  /** Where new chats open: the last placement the user chose, back to the dock when they close the window. */
  readonly placement: AiChatPlacement;
  /** Set when the user first opens the chat from a robot button: the buttons stop glowing. */
  readonly discovered: boolean;
  readonly rightPanelWidth: number;
  readonly remoteHost: AiRemoteHost;
}

const emptyProvider: AiProviderPreferences = { defaultModel: "", defaultEffort: "", extraModels: [] };

export const defaultOpenAiLabel = "OpenAI-compatible server";

export const defaultAiChatPreferences: AiChatPreferences = {
  systemPrompt: "",
  askBeforeEachChange: false,
  defaultProvider: "claude",
  claudePath: "",
  codexPath: "",
  musePath: "",
  openAiLabel: defaultOpenAiLabel,
  openAiEndpoint: { kind: "none" },
  providers: Object.fromEntries(aiProviderIds.map((id) => [id, emptyProvider])) as unknown as Record<
    AiProviderId,
    AiProviderPreferences
  >,
  placement: "bottom",
  discovered: false,
  rightPanelWidth: 420,
  remoteHost: defaultAiRemoteHost,
};

/** Whether the OpenAI-compatible backend is set up, and so offered in the chat. */
export const isOpenAiConfigured = ({ openAiEndpoint: endpoint }: AiChatPreferences) =>
  endpoint.kind === "url"
    ? endpoint.url.trim() !== ""
    : endpoint.kind === "service" && endpoint.namespace.trim() !== "" && endpoint.service.trim() !== "";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readString = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);

const readModels = (value: unknown): readonly string[] =>
  Array.isArray(value)
    ? [
        ...new Set(value.filter((model): model is string => typeof model === "string").map((model) => model.trim())),
      ].filter(Boolean)
    : [];

const readNumber = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;

// 2.2 shipped its author's own model server as the default: a stored copy of it is not a choice.
const isOldDefaultEndpoint = (value: Record<string, unknown>) =>
  value.kind === "service" &&
  value.namespace === "llm" &&
  value.service === "muse-glimmer-llamacpp" &&
  value.port === "8000";

const readEndpoint = (value: unknown): AiOpenAiEndpoint => {
  if (!isRecord(value) || isOldDefaultEndpoint(value)) {
    return { kind: "none" };
  }

  if (value.kind === "url") {
    return { kind: "url", url: readString(value.url) };
  }

  if (value.kind === "service") {
    return {
      kind: "service",
      namespace: readString(value.namespace),
      service: readString(value.service),
      port: readString(value.port),
    };
  }

  return { kind: "none" };
};

const readProvider = (value: unknown): AiProviderPreferences => {
  if (!isRecord(value)) {
    return emptyProvider;
  }

  return {
    defaultModel: readString(value.defaultModel).trim(),
    defaultEffort: readString(value.defaultEffort).trim(),
    // The hand-typed `models` lists of 2.2 are dropped: the CLIs report their models now.
    extraModels: readModels(value.extraModels),
  };
};

/** The stored preferences, with anything missing or malformed replaced by its default. */
export function readAiChatPreferences(value: unknown): AiChatPreferences {
  if (!isRecord(value)) {
    return defaultAiChatPreferences;
  }

  const providers = isRecord(value.providers) ? value.providers : {};
  const label = readString(value.openAiLabel).trim();

  return {
    systemPrompt: readString(value.systemPrompt),
    askBeforeEachChange: value.askBeforeEachChange === true,
    defaultProvider: isAiProviderId(value.defaultProvider)
      ? value.defaultProvider
      : defaultAiChatPreferences.defaultProvider,
    claudePath: readString(value.claudePath).trim(),
    codexPath: readString(value.codexPath).trim(),
    musePath: readString(value.musePath).trim(),
    // "Muse" was the 2.2 default name of the OpenAI-compatible backend; Muse is now Meta's CLI.
    openAiLabel: label && label !== "Muse" ? label : defaultOpenAiLabel,
    openAiEndpoint: readEndpoint(value.openAiEndpoint),
    providers: Object.fromEntries(aiProviderIds.map((id) => [id, readProvider(providers[id])])) as unknown as Record<
      AiProviderId,
      AiProviderPreferences
    >,
    placement: value.placement === "right" || value.placement === "window" ? value.placement : "bottom",
    discovered: value.discovered === true,
    rightPanelWidth: readNumber(value.rightPanelWidth, defaultAiChatPreferences.rightPanelWidth, 280, 1600),
    remoteHost: readRemoteHost(value.remoteHost),
  };
}

const readRemoteHost = (value: unknown): AiRemoteHost =>
  isRecord(value)
    ? {
        enabled: value.enabled === true,
        destination: readString(value.destination).trim(),
        port: /^\d{1,5}$/.test(readString(value.port).trim()) ? readString(value.port).trim() : "",
        identityFile: readString(value.identityFile).trim(),
        configFile: readString(value.configFile).trim(),
      }
    : defaultAiRemoteHost;
