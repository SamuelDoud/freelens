/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { loggerInjectionToken } from "@freelensapp/logger";
import { flushPromises } from "@freelensapp/test-utils";
import { describe, expect, it, vi } from "vitest";
import { getDiForUnitTesting } from "../../../main/getDiForUnitTesting";
import computeShellEnvironmentInjectable from "./compute-shell-environment.injectable";
import setupShellInjectable from "./setup-shell.injectable";

import type { Logger } from "@freelensapp/logger";

describe("setting up the shell environment", () => {
  it("logs a sync that throws and still settles readiness", async () => {
    const di = getDiForUnitTesting();
    const error = vi.fn();

    di.override(
      loggerInjectionToken,
      () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), silly: vi.fn(), error }) as unknown as Logger,
    );
    di.override(computeShellEnvironmentInjectable, () => async () => {
      throw new Error("shell exploded");
    });

    di.inject(setupShellInjectable).run();
    await flushPromises();

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("[SHELL-SYNC]"),
      expect.objectContaining({ message: "shell exploded" }),
    );
  });
});
