/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import { parseClaudeStreamLine, parseCodexStreamLine } from "../common/cli-events";
import { buildClaudeArgs, buildClaudeMcpConfig, buildCodexArgs, codexMcpTokenVariable } from "./cli-args";
import { aiWorkDir } from "./work-dir";
import type { ChildProcess } from "node:child_process";

import type { Spawn } from "../../../main/child-process/spawn.injectable";
import type { AiCliEvent } from "../common/cli-events";

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
  spawn: Spawn;
  env: () => NodeJS.ProcessEnv;
  logInfo: (message: string) => void;
}

const stderrTailBytes = 4000;

/** The turns of Claude Code and Codex: one process per turn, continuing the CLI's own session. */
export class AiCliTurns {
  private readonly running = new Map<string, ChildProcess>();

  constructor(private readonly dependencies: AiCliTurnsDependencies) {}

  start(turn: CliTurn, onEvent: (event: AiCliEvent) => void) {
    const { workDir, emptyKubeconfig } = aiWorkDir();
    const newSessionId = turn.resumeSessionId ? undefined : randomUUID();
    let args: string[];
    let parse: (line: string) => AiCliEvent[];

    if (turn.provider === "claude") {
      const mcpConfigPath = path.join(workDir, `mcp-${turn.chatId}.json`);

      writeFileSync(mcpConfigPath, JSON.stringify(buildClaudeMcpConfig(turn.mcpUrl, turn.mcpToken)), { mode: 0o600 });
      args = buildClaudeArgs({ ...turn, mcpConfigPath, newSessionId });
      parse = parseClaudeStreamLine;
    } else {
      args = buildCodexArgs(turn);
      parse = parseCodexStreamLine;
    }

    this.dependencies.logInfo(`[AI-CHAT]: starting ${turn.command} for chat ${turn.chatId}`);

    const child = this.dependencies.spawn(turn.command, args, {
      cwd: workDir,
      env: { ...this.dependencies.env(), KUBECONFIG: emptyKubeconfig, [codexMcpTokenVariable]: turn.mcpToken },
      stdio: ["ignore", "pipe", "pipe"],
    });

    this.running.set(turn.chatId, child);

    let finished = false;
    let stderrTail = "";
    const finish = (error?: string) => {
      if (!finished) {
        finished = true;
        onEvent(error ? { kind: "done", error } : { kind: "done" });
      }
    };

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
      finish(error.code === "ENOENT" ? `Freelens could not find "${turn.command}".` : error.message);
    });

    child.on("close", (code, signal) => {
      this.running.delete(turn.chatId);

      if (signal) {
        finish("Stopped.");
      } else if (code !== 0) {
        finish(stderrTail.trim() || `${turn.command} exited with code ${code}.`);
      } else {
        finish();
      }
    });
  }

  stop(chatId: string) {
    this.running.get(chatId)?.kill("SIGTERM");
  }
}
