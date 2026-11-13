/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { Logger } from "@freelensapp/logger";

import type { CrashStore } from "./crash-store";

type Listener = (...args: any[]) => void;

export interface CrashHandlerApp {
  on(event: string, listener: Listener): unknown;
  exit(code: number): void;
}

export interface CrashHandlerDependencies {
  store: Pick<CrashStore, "beginSession" | "writeReport">;
  app: CrashHandlerApp;
  processEvents: { on(event: string, listener: Listener): unknown };
  logger: Pick<Logger, "error">;
  showErrorPopup: (heading: string, message: string) => void;
}

interface ProcessGoneDetails {
  reason: string;
  exitCode: number;
  type?: string;
  name?: string;
}

const describeError = (error: unknown): { message: string; stack?: string } => {
  if (error instanceof Error) {
    return { message: `${error.name}: ${error.message}`, stack: error.stack };
  }

  return { message: String(error) };
};

/**
 * Records the crashes the main process can still observe before dying:
 * its own uncaught errors, dead renderers and dead child processes. A run
 * that is killed outright leaves no report — the session marker the store
 * writes here is how the next start notices it instead.
 */
export const setupCrashHandlers = ({
  store,
  app,
  processEvents,
  logger,
  showErrorPopup,
}: CrashHandlerDependencies): void => {
  store.beginSession();

  const writeReport = (kind: string, error: unknown, message?: string): string | undefined => {
    try {
      const report = message !== undefined ? { kind, message } : { kind, ...describeError(error) };

      return store.writeReport(report);
    } catch (writeError) {
      try {
        logger.error("[CRASH-REPORTING]: failed to write crash report", { error: writeError });
      } catch {
        // Nothing sensible left to do while crashing.
      }

      return undefined;
    }
  };

  let exiting = false;

  processEvents.on("uncaughtException", (error: Error) => {
    if (exiting) {
      return;
    }

    exiting = true;

    const reportPath = writeReport("uncaught-exception", error);

    try {
      logger.error("[CRASH-REPORTING]: uncaught exception", { error });
    } catch {
      // See above.
    }

    try {
      showErrorPopup(
        "Freelens crashed",
        reportPath
          ? `An unexpected error crashed Freelens. A crash report was saved to:\n${reportPath}`
          : "An unexpected error crashed Freelens, and the crash report could not be saved.",
      );
    } catch {
      // The app exits either way.
    }

    app.exit(1);
  });

  processEvents.on("unhandledRejection", (error: unknown) => {
    writeReport("unhandled-rejection", error);

    try {
      logger.error("[CRASH-REPORTING]: unhandled rejection", { error });
    } catch {
      // See above.
    }
  });

  app.on(
    "browser-window-created",
    (_event: unknown, win: { webContents: { on(event: string, listener: Listener): unknown } }) => {
      win.webContents.on("render-process-gone", (_goneEvent: unknown, details: ProcessGoneDetails) => {
        if (details.reason !== "clean-exit") {
          writeReport(
            "renderer-gone",
            undefined,
            `Renderer process gone: ${details.reason} (exit code ${details.exitCode})`,
          );
        }
      });
    },
  );

  app.on("child-process-gone", (_event: unknown, details: ProcessGoneDetails) => {
    if (details.reason !== "clean-exit") {
      writeReport(
        "child-process-gone",
        undefined,
        `${details.type ?? "Child"} process gone: ${details.reason} (exit code ${details.exitCode})`,
      );
    }
  });
};
