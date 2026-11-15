/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { accessSync, constants, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { aiWorkDir } from "./work-dir";
import type { ChildProcess } from "node:child_process";

import type { Spawn } from "../../../main/child-process/spawn.injectable";

export interface AiCliHostSpawnOptions {
  readonly cwd: string;
  /** Variables added to the host's own environment */
  readonly env: Readonly<Record<string, string>>;
  /**
   * Whether the command reads its stdin. One that does not gets an open pipe all the same: on a
   * remote host, closing it is what ends the command when the turn stops.
   */
  readonly readsStdin: boolean;
}

/**
 * Where the AI CLIs run: this computer, or another host over SSH. Everything a turn needs of the
 * computer it runs on goes through here.
 */
export interface AiCliHost {
  /** "this computer", or the host's name */
  readonly label: string;
  readonly remote: boolean;
  /** Connects to the host, asking for what it needs to (a host key, a passphrase, a second factor). */
  connect(): Promise<void>;
  /** The directory the agents run in, and a kubeconfig without clusters for them. */
  workDir(): Promise<{ workDir: string; emptyKubeconfig: string }>;
  join(...parts: string[]): string;
  writeFile(file: string, content: string): Promise<void>;
  mkdir(dir: string): Promise<void>;
  remove(file: string): Promise<void>;
  /** The URL of Freelens's MCP server as the host reaches it */
  mcpUrl(localUrl: string): Promise<string>;
  /** The command a CLI runs as: the configured path if it is one, or the first match on the PATH. */
  resolveCommand(name: string, configured: string): Promise<string | undefined>;
  spawn(command: string, args: string[], options: AiCliHostSpawnOptions): Promise<ChildProcess>;
  /** Lets go of the connection. */
  close(): void;
}

const isExecutable = (file: string) => {
  try {
    accessSync(file, constants.X_OK);

    return true;
  } catch {
    return false;
  }
};

export interface LocalCliHostDependencies {
  spawn: Spawn;
  /** Read at each use: the shell sync replaces process.env once the login shell's environment is known */
  env: () => NodeJS.ProcessEnv;
  platform: NodeJS.Platform;
}

/** This computer: the CLIs run as installed here. */
export class LocalCliHost implements AiCliHost {
  readonly label = "this computer";
  readonly remote = false;

  constructor(private readonly dependencies: LocalCliHostDependencies) {}

  async connect() {}

  async workDir() {
    return aiWorkDir();
  }

  join(...parts: string[]) {
    return path.join(...parts);
  }

  async writeFile(file: string, content: string) {
    writeFileSync(file, content, { mode: 0o600 });
  }

  async mkdir(dir: string) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  async remove(file: string) {
    rmSync(file, { recursive: true, force: true });
  }

  async mcpUrl(localUrl: string) {
    return localUrl;
  }

  async resolveCommand(name: string, configured: string) {
    if (configured.trim()) {
      return isExecutable(configured.trim()) ? configured.trim() : undefined;
    }

    const extensions = this.dependencies.platform === "win32" ? ["", ".exe", ".cmd", ".bat"] : [""];
    const directories = (this.dependencies.env().PATH ?? "").split(path.delimiter).filter(Boolean);

    for (const directory of directories) {
      for (const extension of extensions) {
        const candidate = path.join(directory, `${name}${extension}`);

        if (isExecutable(candidate)) {
          return candidate;
        }
      }
    }

    return undefined;
  }

  async spawn(command: string, args: string[], { cwd, env, readsStdin }: AiCliHostSpawnOptions) {
    return this.dependencies.spawn(command, args, {
      cwd,
      env: { ...this.dependencies.env(), ...env },
      stdio: [readsStdin ? "pipe" : "ignore", "pipe", "pipe"],
    });
  }

  close() {}
}
