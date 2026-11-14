/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { museEfforts, parseClaudeModels, parseCodexModels, parseMuseDefaultEffort, parseMuseModels } from "./discovery";

// Shapes recorded from the CLIs: Claude Code 2.1, Codex 0.169 and Muse 1.4.
describe("parseClaudeModels", () => {
  it("reads the models of the initialize reply, with their efforts", () => {
    expect(
      parseClaudeModels({
        models: [
          {
            value: "default",
            displayName: "Default (recommended)",
            description: "Fable 5.2",
            supportsEffort: true,
            supportedEffortLevels: ["low", "medium", "high", "xhigh", "max"],
          },
          { value: "claude-haiku-4-5-20251001", displayName: "Haiku 4.5", description: "Fastest for quick answers" },
          { displayName: "no value" },
        ],
      }),
    ).toEqual([
      {
        id: "default",
        name: "Default (recommended)",
        description: "Fable 5.2",
        efforts: ["low", "medium", "high", "xhigh", "max"],
      },
      { id: "claude-haiku-4-5-20251001", name: "Haiku 4.5", description: "Fastest for quick answers", efforts: [] },
    ]);
    expect(parseClaudeModels(undefined)).toEqual([]);
  });
});

describe("parseCodexModels", () => {
  it("reads the listed models of the catalog and leaves out the hidden ones", () => {
    expect(
      parseCodexModels({
        models: [
          {
            slug: "gpt-6-sol",
            display_name: "GPT-6-Sol",
            default_reasoning_level: "medium",
            supported_reasoning_levels: [{ effort: "low" }, { effort: "medium" }, { effort: "high" }],
            visibility: "list",
          },
          { slug: "codex-auto-review", display_name: "Codex Auto Review", visibility: "hide" },
        ],
      }),
    ).toEqual([
      {
        id: "gpt-6-sol",
        name: "GPT-6-Sol",
        description: undefined,
        efforts: ["low", "medium", "high"],
        defaultEffort: "medium",
      },
    ]);
  });
});

describe("parseMuseModels", () => {
  it("reads the options of the model config option of a new ACP session, the current one first", () => {
    const models = parseMuseModels({
      sessionId: "s",
      configOptions: [
        { id: "mode", category: "mode", options: [{ value: "allowAll", name: "Allow all" }] },
        {
          id: "model",
          category: "model",
          currentValue: "muse-wonder-full-1.0",
          options: [
            { value: "muse-wonder-1.0", name: "muse-wonder-1.0" },
            { value: "muse-wonder-full-1.0", name: "muse-wonder-full-1.0" },
            { value: "muse-spark-1.3", name: "muse-spark-1.3" },
          ],
        },
      ],
    });

    expect(models.map((model) => model.id)).toEqual(["muse-wonder-full-1.0", "muse-wonder-1.0", "muse-spark-1.3"]);
    expect(models[0].efforts).toEqual(museEfforts);
  });

  it("reads a model's default effort from its profile", () => {
    expect(parseMuseDefaultEffort("model:  muse-spark-1.3\neffort: high\n\n  default_reasoning_effort   high\n")).toBe(
      "high",
    );
    expect(parseMuseDefaultEffort("nothing here")).toBeUndefined();
  });
});
