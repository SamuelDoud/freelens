/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { openAiEfforts } from "./providers";

import type { AiCliModel } from "./discovery";
import type { AiProviderId } from "./providers";

/** The models a chat can pick for its backend: those the CLI reports, then the user's extra ones. */
export function modelsFor(
  provider: AiProviderId,
  reported: readonly AiCliModel[],
  extraModels: readonly string[],
): AiCliModel[] {
  const extra = extraModels
    .filter((id) => !reported.some((model) => model.id === id))
    .map((id) => ({ id, name: id, efforts: provider === "openai" ? openAiEfforts : [] }));

  return [...reported, ...extra];
}
