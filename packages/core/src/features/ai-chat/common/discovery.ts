/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { aiCliProviderIds } from "./providers";

import type { AiCliProviderId } from "./providers";

/** A model a CLI offers, as it describes it. */
export interface AiCliModel {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  /** The efforts the model takes; empty when it takes none. */
  readonly efforts: readonly string[];
  readonly defaultEffort?: string;
}

export interface AiCliStatus {
  readonly provider: AiCliProviderId;
  readonly state: "checking" | "found" | "missing" | "error";
  readonly path?: string;
  readonly version?: string;
  /** Undefined when the CLI cannot tell. */
  readonly signedIn?: boolean;
  /** The models in the CLI's order; the first is its default. */
  readonly models: readonly AiCliModel[];
  readonly error?: string;
  readonly checkedAt?: number;
}

export type AiDiscovery = Readonly<Record<AiCliProviderId, AiCliStatus>>;

export const initialAiDiscovery: AiDiscovery = Object.fromEntries(
  aiCliProviderIds.map((provider) => [provider, { provider, state: "checking", models: [] }]),
) as unknown as AiDiscovery;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const strings = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

/**
 * The models of Claude Code's reply to the `initialize` control request: `value`, `displayName`,
 * `description` and, when the model takes efforts, `supportedEffortLevels`.
 */
export function parseClaudeModels(initializeResponse: unknown): AiCliModel[] {
  const models =
    isRecord(initializeResponse) && Array.isArray(initializeResponse.models) ? initializeResponse.models : [];

  return models.filter(isRecord).flatMap((model) => {
    if (typeof model.value !== "string") {
      return [];
    }

    return [
      {
        id: model.value,
        name: typeof model.displayName === "string" ? model.displayName : model.value,
        description: typeof model.description === "string" ? model.description : undefined,
        efforts: model.supportsEffort === false ? [] : strings(model.supportedEffortLevels),
      },
    ];
  });
}

/** The models Codex lists (`codex debug models`), leaving out the hidden ones. */
export function parseCodexModels(catalog: unknown): AiCliModel[] {
  const models = isRecord(catalog) && Array.isArray(catalog.models) ? catalog.models : [];

  return models
    .filter(isRecord)
    .filter((model) => model.visibility === undefined || model.visibility === "list")
    .flatMap((model) => {
      if (typeof model.slug !== "string") {
        return [];
      }

      const levels = Array.isArray(model.supported_reasoning_levels) ? model.supported_reasoning_levels : [];

      return [
        {
          id: model.slug,
          name: typeof model.display_name === "string" ? model.display_name : model.slug,
          description: typeof model.description === "string" ? model.description : undefined,
          efforts: levels.flatMap((level) =>
            isRecord(level) && typeof level.effort === "string"
              ? [level.effort]
              : typeof level === "string"
                ? [level]
                : [],
          ),
          defaultEffort: typeof model.default_reasoning_level === "string" ? model.default_reasoning_level : undefined,
        },
      ];
    });
}

/** The efforts Muse takes (`muse --reasoning-effort`), the same for each of its models. */
export const museEfforts: readonly string[] = ["minimal", "low", "medium", "high", "xhigh", "max", "ultra"];

/**
 * The models of Muse's reply to ACP `session/new`: the options of its `model` config option, the
 * current one first.
 */
export function parseMuseModels(sessionNewResult: unknown): AiCliModel[] {
  const options =
    isRecord(sessionNewResult) && Array.isArray(sessionNewResult.configOptions) ? sessionNewResult.configOptions : [];
  const modelOption = options.filter(isRecord).find((option) => option.id === "model" || option.category === "model");

  if (!modelOption || !Array.isArray(modelOption.options)) {
    return [];
  }

  const current = typeof modelOption.currentValue === "string" ? modelOption.currentValue : undefined;
  const models = modelOption.options.filter(isRecord).flatMap((option) =>
    typeof option.value === "string"
      ? [
          {
            id: option.value,
            name: typeof option.name === "string" ? option.name : option.value,
            description: typeof option.description === "string" ? option.description : undefined,
            efforts: museEfforts,
          },
        ]
      : [],
  );

  return [...models.filter((model) => model.id === current), ...models.filter((model) => model.id !== current)];
}

/** `muse model-profile show <model>` prints `default_reasoning_effort   high`. */
export function parseMuseDefaultEffort(modelProfile: string): string | undefined {
  const match = /^\s*default_reasoning_effort\s+(\S+)/m.exec(modelProfile);

  return match && museEfforts.includes(match[1]) ? match[1] : undefined;
}
