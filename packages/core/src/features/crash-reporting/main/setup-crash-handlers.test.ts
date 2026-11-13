/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupCrashHandlers } from "./setup-crash-handlers";

import type { Mock } from "vitest";

import type { CrashHandlerDependencies } from "./setup-crash-handlers";

describe("setupCrashHandlers", () => {
  let app: EventEmitter & { exit: ReturnType<typeof vi.fn<(code: number) => void>> };
  let processEvents: EventEmitter;
  let store: {
    beginSession: Mock<CrashHandlerDependencies["store"]["beginSession"]>;
    writeReport: Mock<CrashHandlerDependencies["store"]["writeReport"]>;
  };
  let showErrorPopup: ReturnType<typeof vi.fn<(heading: string, message: string) => void>>;

  beforeEach(() => {
    app = Object.assign(new EventEmitter(), { exit: vi.fn() });
    processEvents = new EventEmitter();
    store = {
      beginSession: vi.fn(),
      writeReport: vi.fn(() => "/logs/crashes/crash-test.txt"),
    };
    showErrorPopup = vi.fn();

    setupCrashHandlers({
      store,
      app,
      processEvents,
      logger: { error: vi.fn() },
      showErrorPopup,
    });
  });

  it("begins the session so an unclean previous run is detected", () => {
    expect(store.beginSession).toHaveBeenCalledTimes(1);
  });

  it("reports an uncaught exception, tells the user and exits", () => {
    processEvents.emit("uncaughtException", new Error("boom"));

    expect(store.writeReport).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "uncaught-exception", message: "Error: boom" }),
    );
    expect(showErrorPopup).toHaveBeenCalledWith(
      "Freelens crashed",
      expect.stringContaining("/logs/crashes/crash-test.txt"),
    );
    expect(app.exit).toHaveBeenCalledWith(1);
  });

  it("reports an unhandled rejection without exiting", () => {
    processEvents.emit("unhandledRejection", new Error("forgotten promise"));

    expect(store.writeReport).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "unhandled-rejection", message: "Error: forgotten promise" }),
    );
    expect(app.exit).not.toHaveBeenCalled();
  });

  it("reports a dead renderer, but not a window closed in the normal way", () => {
    const webContents = new EventEmitter();

    app.emit("browser-window-created", undefined, { webContents });
    webContents.emit("render-process-gone", undefined, { reason: "clean-exit", exitCode: 0 });

    expect(store.writeReport).not.toHaveBeenCalled();

    webContents.emit("render-process-gone", undefined, { reason: "oom", exitCode: 1 });

    expect(store.writeReport).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "renderer-gone", message: expect.stringContaining("oom") }),
    );
  });

  it("reports a dead child process, but not one that exited cleanly", () => {
    app.emit("child-process-gone", undefined, { type: "GPU", reason: "clean-exit", exitCode: 0 });

    expect(store.writeReport).not.toHaveBeenCalled();

    app.emit("child-process-gone", undefined, { type: "GPU", reason: "crashed", exitCode: 1 });

    expect(store.writeReport).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "child-process-gone", message: expect.stringContaining("GPU") }),
    );
  });

  it("still exits when writing the report fails", () => {
    store.writeReport.mockImplementation(() => {
      throw new Error("disk full");
    });

    processEvents.emit("uncaughtException", new Error("boom"));

    expect(app.exit).toHaveBeenCalledWith(1);
  });
});
