/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { accessSync, constants } from "node:fs";
import path from "node:path";
import {
  initialAiDiscovery,
  parseClaudeModels,
  parseCodexModels,
  parseMuseDefaultEffort,
  parseMuseModels,
} from "../common/discovery";
import { aiCliCommands, aiCliProviderIds } from "../common/providers";

import type { Spawn } from "../../../main/child-process/spawn.injectable";
import type { AiCliModel, AiCliStatus, AiDiscovery } from "../common/discovery";
import type { AiCliProviderId } from "../common/providers";

export interface AiCliDiscoveryDependencies {
  spawn: Spawn;
  env: () => NodeJS.ProcessEnv;
  /** The paths set in the preferences; empty finds the command on the PATH. */
  configuredPaths: () => Readonly<Record<AiCliProviderId, string>>;
  workDir: () => string;
  platform: NodeJS.Platform;
  logWarn: (message: string) => void;
}

interface ProcessResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

const timeoutMs = 15_000;

const isExecutable = (file: string) => {
  try {
    accessSync(file, constants.X_OK);

    return true;
  } catch {
    return false;
  }
};

const lines = (text: string) => text.split(/\r?\n/).filter(Boolean);

const parseJsonLines = (text: string) =>
  lines(text).flatMap((line) => {
    try {
      return [JSON.parse(line) as Record<string, any>];
    } catch {
      return [];
    }
  });

/**
 * Finds the command-line agents installed on this computer and asks each what it offers: its
 * version, whether it is signed in, and its models with their efforts. Nothing is listed in
 * Freelens itself, so that a new model shows as soon as the CLI knows it.
 */
export class AiCliDiscovery {
  private current: AiDiscovery = initialAiDiscovery;
  private pending?: Promise<AiDiscovery>;
  private readonly listeners = new Set<(discovery: AiDiscovery) => void>();

  constructor(private readonly dependencies: AiCliDiscoveryDependencies) {}

  get(): AiDiscovery {
    return this.current;
  }

  onChange(listener: (discovery: AiDiscovery) => void) {
    this.listeners.add(listener);

    return () => this.listeners.delete(listener);
  }

  /** Asks every CLI again; a refresh while one runs joins it. */
  refresh(): Promise<AiDiscovery> {
    this.pending ??= this.discoverAll().finally(() => {
      this.pending = undefined;
    });

    return this.pending;
  }

  /** The command a CLI runs as: the preference's path, or the first match on the PATH. */
  resolveCommand(provider: AiCliProviderId): string | undefined {
    const configured = this.dependencies.configuredPaths()[provider].trim();

    if (configured) {
      return isExecutable(configured) ? configured : undefined;
    }

    const { platform } = this.dependencies;
    const extensions = platform === "win32" ? ["", ".exe", ".cmd", ".bat"] : [""];
    const directories = (this.dependencies.env().PATH ?? "").split(path.delimiter).filter(Boolean);

    for (const directory of directories) {
      for (const extension of extensions) {
        const candidate = path.join(directory, `${aiCliCommands[provider]}${extension}`);

        if (isExecutable(candidate)) {
          return candidate;
        }
      }
    }

    return undefined;
  }

  private async discoverAll(): Promise<AiDiscovery> {
    this.publish(
      Object.fromEntries(
        aiCliProviderIds.map((provider) => [provider, { ...this.current[provider], state: "checking" as const }]),
      ) as unknown as AiDiscovery,
    );

    const statuses = await Promise.all(aiCliProviderIds.map((provider) => this.discover(provider)));

    this.publish(Object.fromEntries(statuses.map((status) => [status.provider, status])) as unknown as AiDiscovery);

    return this.current;
  }

  private publish(discovery: AiDiscovery) {
    this.current = discovery;

    for (const listener of this.listeners) {
      listener(discovery);
    }
  }

  private async discover(provider: AiCliProviderId): Promise<AiCliStatus> {
    const command = this.resolveCommand(provider);
    const checkedAt = Date.now();

    if (!command) {
      return { provider, state: "missing", models: [], checkedAt };
    }

    try {
      const [version, signedIn, models] = await Promise.all([
        this.version(command),
        this.signedIn(provider, command),
        this.models(provider, command),
      ]);

      return { provider, state: "found", path: command, version, signedIn, models, checkedAt };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.dependencies.logWarn(`[AI-CHAT]: discovering ${provider} failed: ${message}`);

      return { provider, state: "error", path: command, models: [], error: message, checkedAt };
    }
  }

  private async version(command: string) {
    const { stdout, stderr } = await this.run(command, ["--version"]);

    return lines(stdout || stderr)[0]?.trim();
  }

  private async signedIn(provider: AiCliProviderId, command: string): Promise<boolean | undefined> {
    switch (provider) {
      case "claude": {
        const { stdout } = await this.run(command, ["auth", "status"]);
        let status: Record<string, unknown> | undefined;

        // It prints one JSON document, over several lines.
        try {
          status = JSON.parse(stdout) as Record<string, unknown>;
        } catch {
          status = undefined;
        }

        return typeof status?.loggedIn === "boolean" ? status.loggedIn : undefined;
      }
      case "codex": {
        const { code, stdout, stderr } = await this.run(command, ["login", "status"]);

        return code === 0 && /logged in/i.test(stdout + stderr) && !/not logged in/i.test(stdout + stderr);
      }
      case "muse": {
        const { code } = await this.run(command, ["usage"]);

        return code === 0;
      }
    }
  }

  private async models(provider: AiCliProviderId, command: string): Promise<AiCliModel[]> {
    switch (provider) {
      case "claude": {
        // The control protocol answers `initialize` with the models of the signed-in account,
        // without starting a turn.
        const { stdout } = await this.run(
          command,
          [
            "-p",
            "--input-format",
            "stream-json",
            "--output-format",
            "stream-json",
            "--verbose",
            "--no-session-persistence",
            "--tools",
            "",
            "--strict-mcp-config",
            "--setting-sources",
            "",
          ],
          {
            input: `${JSON.stringify({ type: "control_request", request_id: "freelens-models", request: { subtype: "initialize" } })}\n`,
            until: (output) => output.includes('"control_response"'),
            keepStdinOpen: true,
          },
        );
        const reply = parseJsonLines(stdout).find((line) => line.type === "control_response");

        return parseClaudeModels(reply?.response?.response);
      }
      case "codex": {
        const { stdout } = await this.run(command, ["debug", "models"]);

        return parseCodexModels(JSON.parse(stdout));
      }
      case "muse": {
        // Muse lists its models as the options of the `model` config option of a new ACP session.
        const { stdout } = await this.run(command, ["acp", "--no-session-log"], {
          input: [
            { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: 1, clientCapabilities: {} } },
            {
              jsonrpc: "2.0",
              id: 2,
              method: "session/new",
              params: { cwd: this.dependencies.workDir(), mcpServers: [] },
            },
          ]
            .map((message) => JSON.stringify(message))
            .join("\n")
            .concat("\n"),
          until: (output) => parseJsonLines(output).some((line) => line.id === 2),
          keepStdinOpen: true,
        });
        const models = parseMuseModels(parseJsonLines(stdout).find((line) => line.id === 2)?.result);

        return Promise.all(
          models.map(async (model) => {
            const profile = await this.run(command, ["model-profile", "show", model.id]).catch(() => undefined);
            const defaultEffort = profile ? parseMuseDefaultEffort(profile.stdout) : undefined;

            return defaultEffort ? { ...model, defaultEffort } : model;
          }),
        );
      }
    }
  }

  private run(
    command: string,
    args: string[],
    options: { input?: string; until?: (stdout: string) => boolean; keepStdinOpen?: boolean } = {},
  ): Promise<ProcessResult> {
    return new Promise((resolve, reject) => {
      const child = this.dependencies.spawn(command, args, {
        cwd: this.dependencies.workDir(),
        env: this.dependencies.env(),
        stdio: ["pipe", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      let settled = false;
      const finish = (result: Omit<ProcessResult, "stdout" | "stderr">) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({ ...result, stdout, stderr });
        }
      };
      const timer = setTimeout(() => {
        child.kill?.();
        finish({ code: null, timedOut: true });
      }, timeoutMs);

      child.on("error", (error) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(error);
        }
      });
      child.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");

        if (options.until?.(stdout)) {
          child.kill();
          finish({ code: 0, timedOut: false });
        }
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });
      child.on("close", (code) => finish({ code, timedOut: false }));

      if (options.input !== undefined) {
        child.stdin?.write(options.input);
      }

      // Most commands read their stdin to its end; the protocol servers stop when it closes.
      if (!options.keepStdinOpen) {
        child.stdin?.end();
      }
    });
  }
}
