/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { CrashStore } from "./crash-store";

import type { CrashFileSystem } from "./crash-store";

class FakeCrashFileSystem implements CrashFileSystem {
  readonly files = new Map<string, string>();

  existsSync(path: string): boolean {
    return this.files.has(path);
  }

  mkdirSync(_path: string, _options: { recursive: true }): undefined {
    return undefined;
  }

  writeFileSync(path: string, data: string): void {
    this.files.set(path, data);
  }

  readFileSync(path: string, _encoding: "utf-8"): string {
    const contents = this.files.get(path);

    if (contents === undefined) {
      throw new Error(`ENOENT: ${path}`);
    }

    return contents;
  }

  readdirSync(path: string): string[] {
    const prefix = `${path}/`;

    return [...this.files.keys()]
      .filter((file) => file.startsWith(prefix))
      .map((file) => file.slice(prefix.length))
      .filter((name) => !name.includes("/"));
  }

  rmSync(path: string, _options: { force: true }): void {
    this.files.delete(path);
  }
}

describe("CrashStore", () => {
  let fs: FakeCrashFileSystem;
  let now: Date;

  const makeStore = () =>
    new CrashStore({
      directory: "/logs",
      fs,
      now: () => now,
      appVersion: "1.2.3",
      versions: { electron: "40.0.0", chrome: "140.0.0", node: "24.0.0" },
      platform: "linux x64",
    });

  beforeEach(() => {
    fs = new FakeCrashFileSystem();
    now = new Date("2026-11-13T06:30:00.000Z");
  });

  it("writes a crash report with the error and the versions in it", () => {
    const store = makeStore();
    const path = store.writeReport({
      kind: "uncaught-exception",
      message: "TypeError: boom",
      stack: "TypeError: boom\n    at somewhere",
    });

    expect(path).toBe("/logs/crashes/crash-2026-11-13T06-30-00-000Z-uncaught-exception.txt");
    expect(fs.readFileSync(path, "utf-8")).toContain("Freelens 1.2.3");
    expect(fs.readFileSync(path, "utf-8")).toContain("Electron 40.0.0");
    expect(fs.readFileSync(path, "utf-8")).toContain("TypeError: boom");
    expect(fs.readFileSync(path, "utf-8")).toContain("at somewhere");
  });

  it("keeps only the ten newest crash reports", () => {
    const store = makeStore();

    for (let index = 0; index < 12; index++) {
      now = new Date(Date.UTC(2026, 10, 13, 6, 30, index));
      store.writeReport({ kind: "renderer-gone", message: `crash ${index}` });
    }

    const reports = fs.readdirSync("/logs/crashes").filter((name) => name.startsWith("crash-"));

    expect(reports).toHaveLength(10);
    expect(reports.some((name) => fs.readFileSync(`/logs/crashes/${name}`, "utf-8").includes("crash 0"))).toBe(false);
    expect(reports.some((name) => fs.readFileSync(`/logs/crashes/${name}`, "utf-8").includes("crash 11"))).toBe(true);
  });

  it("notices a previous run that did not end cleanly, once", () => {
    const first = makeStore();

    first.beginSession();
    first.writeReport({ kind: "renderer-gone", message: "Renderer process gone: oom" });
    // No endSessionCleanly: this run "crashed".

    const second = makeStore();

    second.beginSession();

    const notice = second.takePendingNotice();

    expect(notice?.uncleanExit).toBe(true);
    expect(notice?.reportPaths).toHaveLength(1);
    expect(notice?.reportPaths[0]).toContain("renderer-gone");
    expect(second.takePendingNotice()).toBeUndefined();

    second.endSessionCleanly();

    const third = makeStore();

    third.beginSession();

    // The report was already shown and the last run ended cleanly.
    expect(third.takePendingNotice()).toBeUndefined();
  });

  it("notices an unclean exit even without a crash report", () => {
    const first = makeStore();

    first.beginSession();
    // Killed before it could write anything (kill -9, power loss).

    const second = makeStore();

    second.beginSession();

    expect(second.takePendingNotice()).toEqual({ reportPaths: [], uncleanExit: true });
  });

  it("notices nothing after a clean exit with no crashes", () => {
    const first = makeStore();

    first.beginSession();
    first.endSessionCleanly();

    const second = makeStore();

    second.beginSession();

    expect(second.takePendingNotice()).toBeUndefined();
  });
});
