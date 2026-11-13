/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import path from "node:path";

/**
 * The synchronous file operations the store uses. Synchronous on purpose:
 * a crash report written from a dying process cannot wait for a promise.
 */
export interface CrashFileSystem {
  existsSync(path: string): boolean;
  mkdirSync(path: string, options: { recursive: true }): unknown;
  writeFileSync(path: string, data: string): void;
  readFileSync(path: string, encoding: "utf-8"): string;
  readdirSync(path: string): string[];
  rmSync(path: string, options: { force: true }): void;
}

export interface CrashReport {
  /** What died, e.g. "uncaught-exception" or "renderer-gone" */
  kind: string;
  message: string;
  stack?: string;
}

export interface PendingCrashNotice {
  /** Crash reports the user has not been shown yet, oldest first */
  reportPaths: string[];
  /** The previous run did not end with a clean quit */
  uncleanExit: boolean;
}

export interface CrashStoreDependencies {
  /** The logs directory; reports live in its `crashes` subdirectory. */
  readonly directory: string;
  readonly fs: CrashFileSystem;
  readonly now: () => Date;
  readonly appVersion: string;
  readonly versions: { electron?: string; chrome?: string; node: string };
  readonly platform: string;
}

const maxReportsKept = 10;
const sessionRunningFileName = "session-running";
const lastShownFileName = "last-shown";

/**
 * Writes crash reports next to the log files and remembers, across runs,
 * whether the previous run ended cleanly: `beginSession` leaves a marker
 * file behind and only a clean quit removes it. Everything here is
 * synchronous and defensive — reporting a crash must never throw into the
 * code that is already crashing.
 */
export class CrashStore {
  private previousRunEndedUncleanly = false;

  constructor(private readonly dependencies: CrashStoreDependencies) {}

  private get crashesDirectory(): string {
    return path.join(this.dependencies.directory, "crashes");
  }

  private get sessionRunningPath(): string {
    return path.join(this.crashesDirectory, sessionRunningFileName);
  }

  private get lastShownPath(): string {
    return path.join(this.crashesDirectory, lastShownFileName);
  }

  beginSession(): void {
    try {
      this.dependencies.fs.mkdirSync(this.crashesDirectory, { recursive: true });
      this.previousRunEndedUncleanly = this.dependencies.fs.existsSync(this.sessionRunningPath);
      this.dependencies.fs.writeFileSync(this.sessionRunningPath, this.dependencies.now().toISOString());
    } catch {
      // A read-only or missing logs directory must not stop the app.
    }
  }

  endSessionCleanly(): void {
    try {
      this.dependencies.fs.rmSync(this.sessionRunningPath, { force: true });
    } catch {
      // The marker staying behind only costs a notice at the next start.
    }
  }

  writeReport(report: CrashReport): string {
    const { fs, now, appVersion, versions, platform } = this.dependencies;
    const timestamp = now().toISOString().replaceAll(/[:.]/g, "-");
    let fileName = `crash-${timestamp}-${report.kind}.txt`;
    let filePath = path.join(this.crashesDirectory, fileName);

    for (let counter = 2; fs.existsSync(filePath); counter++) {
      fileName = `crash-${timestamp}-${report.kind}-${counter}.txt`;
      filePath = path.join(this.crashesDirectory, fileName);
    }

    const lines = [
      `Freelens ${appVersion} crash report`,
      `Time: ${now().toISOString()}`,
      `Kind: ${report.kind}`,
      `Electron ${versions.electron ?? "unknown"}, Chrome ${versions.chrome ?? "unknown"}, Node ${versions.node}`,
      `Platform: ${platform}`,
      "",
      report.message,
    ];

    if (report.stack) {
      lines.push("", report.stack);
    }

    fs.mkdirSync(this.crashesDirectory, { recursive: true });
    fs.writeFileSync(filePath, `${lines.join("\n")}\n`);
    this.pruneOldReports();

    return filePath;
  }

  /**
   * The notice for the previous run, once: taking it marks its reports as
   * shown, so the user is told about each crash a single time.
   */
  takePendingNotice(): PendingCrashNotice | undefined {
    const unseen = this.unseenReportNames();

    if (!this.previousRunEndedUncleanly && unseen.length === 0) {
      return undefined;
    }

    const notice: PendingCrashNotice = {
      reportPaths: unseen.map((name) => path.join(this.crashesDirectory, name)),
      uncleanExit: this.previousRunEndedUncleanly,
    };

    this.previousRunEndedUncleanly = false;

    const newest = this.reportNames().at(-1);

    if (newest) {
      try {
        this.dependencies.fs.writeFileSync(this.lastShownPath, newest);
      } catch {
        // Showing the notice again next time beats failing over this.
      }
    }

    return notice;
  }

  private reportNames(): string[] {
    try {
      return this.dependencies.fs
        .readdirSync(this.crashesDirectory)
        .filter((name) => name.startsWith("crash-") && name.endsWith(".txt"))
        .sort();
    } catch {
      return [];
    }
  }

  private unseenReportNames(): string[] {
    let lastShown = "";

    try {
      lastShown = this.dependencies.fs.readFileSync(this.lastShownPath, "utf-8").trim();
    } catch {
      // Nothing shown yet.
    }

    return this.reportNames().filter((name) => name > lastShown);
  }

  private pruneOldReports(): void {
    const names = this.reportNames();

    for (const name of names.slice(0, -maxReportsKept)) {
      try {
        this.dependencies.fs.rmSync(path.join(this.crashesDirectory, name), { force: true });
      } catch {
        // Keeping one report too many is harmless.
      }
    }
  }
}
