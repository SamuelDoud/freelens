/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { parseClaudeStreamLine, parseCodexStreamLine } from "../common/cli-events";
import { buildClaudeArgs, buildClaudeMcpConfig, buildCodexArgs, codexMcpTokenVariable } from "./cli-args";
import type { ChildProcess } from "node:child_process";

import type { Spawn } from "../../../main/child-process/spawn.injectable";
import type { StartAiCliTurn, StartAiCliTurnResult } from "../common/channels";
import type { AiCliEvent } from "../common/cli-events";
import type { AiMcpServer } from "./mcp-server";

export interface AiCliTurnsDependencies {
  spawn: Spawn;
  mcpServer: AiMcpServer;
  sendEvent: (chatId: string, event: AiCliEvent) => void;
  env: () => NodeJS.ProcessEnv;
  logInfo: (message: string) => void;
}

const stderrTailBytes = 4000;

/** The turns of the command-line agents, one at a time per chat. */
export class AiCliTurns {
  private readonly running = new Map<string, ChildProcess>();

  constructor(private readonly dependencies: AiCliTurnsDependencies) {}

  async start(turn: StartAiCliTurn): Promise<StartAiCliTurnResult> {
    if (this.running.has(turn.chatId)) {
      return { ok: false, error: "This chat is already waiting for an answer." };
    }

    const { mcpServer, spawn, sendEvent } = this.dependencies;

    mcpServer.setAllowChanges(turn.chatId, turn.allowChanges);

    const mcpUrl = await mcpServer.urlFor(turn.chatId);
    // The agents run in a directory of their own, so that no project's instructions reach them.
    const workDir = path.join(tmpdir(), "freelens-ai-chat");
    const emptyKubeconfig = path.join(workDir, "no-cluster.kubeconfig");

    mkdirSync(workDir, { recursive: true, mode: 0o700 });
    writeFileSync(emptyKubeconfig, "", { mode: 0o600 });

    let args: string[];
    let parse: (line: string) => AiCliEvent[];
    const newSessionId = turn.resumeSessionId ? undefined : randomUUID();

    if (turn.provider === "claude") {
      const mcpConfigPath = path.join(workDir, `mcp-${turn.chatId}.json`);

      writeFileSync(mcpConfigPath, JSON.stringify(buildClaudeMcpConfig(mcpUrl, mcpServer.token)), { mode: 0o600 });
      args = buildClaudeArgs({ ...turn, mcpUrl, mcpConfigPath, newSessionId });
      parse = parseClaudeStreamLine;
    } else {
      args = buildCodexArgs({ ...turn, mcpUrl });
      parse = parseCodexStreamLine;
    }

    const command = turn.command || turn.provider;

    this.dependencies.logInfo(`[AI-CHAT]: starting ${command} for chat ${turn.chatId}`);

    const child = spawn(command, args, {
      cwd: workDir,
      env: {
        ...this.dependencies.env(),
        // A kubeconfig without clusters, so that nothing the agent runs reaches a cluster except through Freelens.
        KUBECONFIG: emptyKubeconfig,
        [codexMcpTokenVariable]: mcpServer.token,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    this.running.set(turn.chatId, child);

    let finished = false;
    let stderrTail = "";
    const finish = (error?: string) => {
      if (!finished) {
        finished = true;
        sendEvent(turn.chatId, error ? { kind: "done", error } : { kind: "done" });
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
            sendEvent(turn.chatId, event);
          }
        }
      });
    }

    child.on("error", (error: NodeJS.ErrnoException) => {
      this.running.delete(turn.chatId);
      finish(
        error.code === "ENOENT"
          ? `Freelens could not find "${command}". Install it, or set its path in Preferences → AI.`
          : error.message,
      );
    });

    child.on("close", (code, signal) => {
      this.running.delete(turn.chatId);

      if (signal) {
        finish("Stopped.");
      } else if (code !== 0) {
        finish(stderrTail.trim() || `${command} exited with code ${code}.`);
      } else {
        finish();
      }
    });

    return { ok: true };
  }

  stop(chatId: string) {
    this.running.get(chatId)?.kill("SIGTERM");
  }
}
