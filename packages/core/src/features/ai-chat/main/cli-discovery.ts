/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import path from "node:path";
import {
  initialAiDiscovery,
  parseClaudeModels,
  parseCodexModels,
  parseMuseDefaultEffort,
  parseMuseModels,
} from "../common/discovery";
import { aiCliCommands, aiCliProviderIds } from "../common/providers";

import type { AiCliModel, AiCliStatus, AiDiscovery } from "../common/discovery";
import type { AiCliProviderId } from "../common/providers";
import type { AiCliHost } from "./cli-host";

export interface AiCliDiscoveryDependencies {
  /** Where the CLIs run now: this computer, or another host over SSH */
  host: () => AiCliHost;
  /** The paths set in the preferences; empty finds the command on the PATH. */
  configuredPaths: () => Readonly<Record<AiCliProviderId, string>>;
  logWarn: (message: string) => void;
}

interface ProcessResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

const timeoutMs = 15_000;

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
  private discoveredOn?: string;
  private workDir = "";

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

  /** The command a CLI runs as on its host: the preference's path, or the first match on the PATH. */
  resolveCommand(provider: AiCliProviderId): Promise<string | undefined> {
    return this.dependencies
      .host()
      .resolveCommand(aiCliCommands[provider], this.dependencies.configuredPaths()[provider]);
  }

  /** The host the CLIs were last found on */
  get host(): string | undefined {
    return this.discoveredOn;
  }

  private async discoverAll(): Promise<AiDiscovery> {
    const host = this.dependencies.host();

    this.publish(
      Object.fromEntries(
        aiCliProviderIds.map((provider) => [provider, { ...this.current[provider], state: "checking" as const }]),
      ) as unknown as AiDiscovery,
    );

    let statuses: AiCliStatus[];

    try {
      // Connecting asks the user what the host wants, once for all the CLIs.
      await host.connect();
      this.workDir = (await host.workDir()).workDir;
      statuses = await Promise.all(aiCliProviderIds.map((provider) => this.discover(provider)));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.dependencies.logWarn(`[AI-CHAT]: connecting to ${host.label} failed: ${message}`);
      statuses = aiCliProviderIds.map((provider) => ({
        provider,
        state: "error" as const,
        models: [],
        error: `Could not reach ${host.label}: ${message}`,
        checkedAt: Date.now(),
      }));
    }

    statuses = statuses.map((status) => ({ ...status, host: host.label }));
    this.discoveredOn = host.label;

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
    const command = await this.resolveCommand(provider);
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
              params: { cwd: this.workDir, mcpServers: [] },
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
    const spawned = this.dependencies.host().spawn(command, args, { cwd: this.workDir, env: {}, readsStdin: true });

    return spawned.then(
      (child) =>
        new Promise((resolve, reject) => {
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

            if (!settled) {
              settled = true;
              // Not an answer: "not signed in" or "no models" would be wrong.
              reject(new Error(`${path.basename(command)} ${args.join(" ")} did not answer in ${timeoutMs / 1000} s.`));
            }
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
        }),
    );
  }
}
