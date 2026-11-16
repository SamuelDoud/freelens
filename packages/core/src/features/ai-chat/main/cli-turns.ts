/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import { parseClaudeStreamLine, parseCodexStreamLine } from "../common/cli-events";
import { buildClaudeArgs, buildClaudeMcpConfig, buildCodexArgs, codexMcpTokenVariable } from "./cli-args";
import type { ChildProcess } from "node:child_process";

import type { AiCliEvent } from "../common/cli-events";
import type { AiCliHost } from "./cli-host";

export interface CliTurn {
  readonly chatId: string;
  readonly provider: "claude" | "codex";
  readonly command: string;
  readonly prompt: string;
  readonly model: string;
  readonly effort: string;
  readonly systemPrompt: string;
  readonly resumeSessionId?: string;
  readonly mcpUrl: string;
  readonly mcpToken: string;
}

export interface AiCliTurnsDependencies {
  /** Where the CLIs run now: this computer, or another host over SSH */
  host: () => AiCliHost;
  logInfo: (message: string) => void;
}

const stderrTailBytes = 4000;

/** The turns of Claude Code and Codex: one process per turn, continuing the CLI's own session. */
export class AiCliTurns {
  private readonly running = new Map<string, ChildProcess>();
  /** Turns stopped before their process started */
  private readonly stopped = new Set<string>();
  /** Processes stopped by the user */
  private readonly killed = new WeakSet<ChildProcess>();

  constructor(private readonly dependencies: AiCliTurnsDependencies) {}

  start(turn: CliTurn, onEvent: (event: AiCliEvent) => void) {
    let finished = false;
    const finish = (error?: string) => {
      if (!finished) {
        finished = true;
        onEvent(error ? { kind: "done", error } : { kind: "done" });
      }
    };

    this.stopped.delete(turn.chatId);
    void this.run(turn, onEvent, finish).catch((error) =>
      finish(error instanceof Error ? error.message : String(error)),
    );
  }

  private async run(turn: CliTurn, onEvent: (event: AiCliEvent) => void, finish: (error?: string) => void) {
    const host = this.dependencies.host();
    const { workDir, emptyKubeconfig } = await host.workDir();
    // Freelens's MCP server as the host reaches it: itself, or through the SSH connection.
    const mcpUrl = await host.mcpUrl(turn.mcpUrl);
    const newSessionId = turn.resumeSessionId ? undefined : randomUUID();
    const mcpConfigPath = turn.provider === "claude" ? host.join(workDir, `mcp-${turn.chatId}.json`) : undefined;
    const removeConfig = () => {
      // It holds the bearer token: no reason to leave it on the host once the CLI has read it.
      if (mcpConfigPath) void host.remove(mcpConfigPath).catch(() => {});
    };
    let args: string[];
    let parse: (line: string) => AiCliEvent[];

    if (mcpConfigPath) {
      await host.writeFile(mcpConfigPath, JSON.stringify(buildClaudeMcpConfig(mcpUrl, turn.mcpToken)));
      args = buildClaudeArgs({ ...turn, mcpUrl, mcpConfigPath, newSessionId });
      parse = parseClaudeStreamLine;
    } else {
      args = buildCodexArgs({ ...turn, mcpUrl });
      parse = parseCodexStreamLine;
    }

    if (this.stopped.delete(turn.chatId)) {
      removeConfig();
      finish("Stopped.");

      return;
    }

    this.dependencies.logInfo(`[AI-CHAT]: starting ${turn.command} on ${host.label} for chat ${turn.chatId}`);

    const child = await host
      .spawn(turn.command, args, {
        cwd: workDir,
        env: { KUBECONFIG: emptyKubeconfig, [codexMcpTokenVariable]: turn.mcpToken },
        readsStdin: false,
      })
      .catch((error) => {
        removeConfig();
        throw error;
      });

    this.running.set(turn.chatId, child);

    let stderrTail = "";

    child.stderr?.on("data", (chunk: Buffer) => {
      stderrTail = (stderrTail + chunk.toString("utf8")).slice(-stderrTailBytes);
    });

    if (child.stdout) {
      createInterface({ input: child.stdout }).on("line", (line) => {
        for (const event of parse(line)) {
          if (event.kind === "done") {
            finish(event.error);
          } else {
            onEvent(event);
          }
        }
      });
    }

    child.on("error", (error: NodeJS.ErrnoException) => {
      this.running.delete(turn.chatId);
      removeConfig();
      finish(error.code === "ENOENT" ? `Freelens could not find "${turn.command}".` : error.message);
    });

    child.on("close", (code, signal) => {
      this.running.delete(turn.chatId);
      removeConfig();

      // ssh ends with its own code when stopped, not with the signal.
      if (signal || this.killed.has(child)) {
        finish("Stopped.");
      } else if (code !== 0) {
        finish(stderrTail.trim() || `${turn.command} exited with code ${code}.`);
      } else {
        finish();
      }
    });

    // Stopped while connecting to the host or starting the process: stop() found nothing to kill.
    if (this.stopped.delete(turn.chatId)) {
      this.killed.add(child);
      child.kill("SIGTERM");
    }
  }

  stop(chatId: string) {
    const child = this.running.get(chatId);

    if (child) {
      this.killed.add(child);
      child.kill("SIGTERM");
    } else {
      this.stopped.add(chatId);
    }
  }
}
