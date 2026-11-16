/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { createInterface } from "node:readline";
import { findAiTool } from "../common/tools";
import type { ChildProcess } from "node:child_process";

import type { AiCliEvent } from "../common/cli-events";
import type { AiCliHost } from "./cli-host";

export interface MuseTurn {
  readonly chatId: string;
  readonly command: string;
  readonly prompt: string;
  readonly model: string;
  readonly effort: string;
  readonly systemPrompt: string;
  readonly mcpUrl: string;
  readonly mcpToken: string;
}

export interface AiMuseSessionsDependencies {
  /** Where the CLIs run now: this computer, or another host over SSH */
  host: () => AiCliHost;
  logWarn: (message: string) => void;
}

interface JsonRpcMessage {
  jsonrpc?: string;
  id?: number | string;
  method?: string;
  params?: any;
  result?: any;
  error?: { message?: string };
}

/**
 * Turns Muse's ACP `session/update` notifications into chat events: the text the agent writes, in
 * chunks. Tool calls go through Freelens's MCP server, which shows them itself.
 */
export function parseMuseUpdate(params: unknown): AiCliEvent[] {
  const update = (params as { update?: Record<string, any> } | undefined)?.update;

  if (
    update?.sessionUpdate === "agent_message_chunk" &&
    update.content?.type === "text" &&
    typeof update.content.text === "string"
  ) {
    return update.content.text ? [{ kind: "text", text: update.content.text }] : [];
  }

  return [];
}

/**
 * The option to answer Muse's `session/request_permission` with: allow a Freelens tool (Freelens
 * enforces "Allow changes" and approvals itself), reject anything else.
 */
export function choosePermissionOption(params: unknown, announced?: MuseToolCall): string | undefined {
  const { options = [], toolCall = {} } = (params ?? {}) as {
    options?: { optionId: string; kind?: string }[];
    toolCall?: MuseToolCall;
  };
  const known = { ...announced, ...withoutEmpty(toolCall) };
  const wanted = isFreelensToolCall(known) ? ["allow_once", "allow_always"] : ["reject_once", "reject_always"];

  return options.find((option) => wanted.includes(option.kind ?? ""))?.optionId;
}

/** What Muse says about a tool call: in the `tool_call` update that announces it, and in a permission request. */
export interface MuseToolCall {
  toolCallId?: string;
  title?: string;
  name?: string;
  toolName?: string;
  kind?: string;
}

const withoutEmpty = (toolCall: MuseToolCall): MuseToolCall =>
  Object.fromEntries(
    Object.entries(toolCall).filter(([, value]) => value !== undefined && value !== "" && value !== null),
  );

/**
 * Whether a tool call is one of Freelens's: its name, or the start of its title, is a Freelens tool,
 * bare or as Muse names an MCP tool (`mcp__freelens__list_resources`). A title that only mentions
 * Freelens, such as a fetch of its website, is not.
 */
const isFreelensToolCall = ({ name, toolName, title }: MuseToolCall) =>
  [name, toolName, title].some((identity) => {
    const name = identity?.trim().match(/^(?:mcp__freelens(?:__|[.:])|freelens[.:]\s*)?([A-Za-z_]+)(?=$|[\s(])/)?.[1];

    return name !== undefined && findAiTool(name) !== undefined;
  });

/** The environment variable that carries the MCP server's Authorization header to Muse. */
export const museMcpAuthVariable = "FREELENS_MCP_AUTH";

/**
 * A chat's workspace for Muse. Muse takes MCP servers only from settings it trusts: a project's
 * `.mcp.json`, read when the run trusts the workspace (`--trust-workspace`, which is not saved).
 * The workspace is a minimal repository holding only that file; its secret header is a reference to
 * an environment variable, as Muse wants it.
 */
export async function prepareMuseWorkspace(
  host: AiCliHost,
  baseDir: string,
  chatId: string,
  mcpUrl: string,
): Promise<string> {
  const workspace = host.join(baseDir, `muse-${chatId}`);
  const authReference = "${" + museMcpAuthVariable + "}";

  await host.mkdir(host.join(workspace, ".git", "objects"));
  await host.mkdir(host.join(workspace, ".git", "refs", "heads"));
  await host.writeFile(host.join(workspace, ".git", "HEAD"), "ref: refs/heads/main\n");
  await host.writeFile(
    host.join(workspace, ".mcp.json"),
    JSON.stringify({
      mcpServers: { freelens: { type: "http", url: mcpUrl, headers: { Authorization: authReference } } },
    }),
  );

  return workspace;
}

interface MuseSession {
  child: ChildProcess;
  host: AiCliHost;
  workspace: string;
  sessionId?: string;
  effort: string;
  model: string;
  nextId: number;
  pending: Map<number, { resolve: (result: any) => void; reject: (error: Error) => void }>;
  onEvent?: (event: AiCliEvent) => void;
  bufferedText: string;
  /** The tool calls Muse announced, by id: its permission requests may leave their names out. */
  toolCalls: Map<string, MuseToolCall>;
}

/**
 * Meta's Muse, driven over the Agent Client Protocol: one `muse acp` process per chat for the
 * whole conversation, as Muse cannot reload a session it has not saved. Its shell and file writes
 * are off, Freelens's MCP server is its tool source, and a kubeconfig without clusters keeps
 * anything else away from the cluster.
 */
export class AiMuseSessions {
  private readonly sessions = new Map<string, MuseSession>();
  /** Chats stopped before their session was ready to be cancelled */
  private readonly stopRequested = new Set<string>();

  constructor(private readonly dependencies: AiMuseSessionsDependencies) {}

  async prompt(turn: MuseTurn, onEvent: (event: AiCliEvent) => void): Promise<void> {
    let session = this.sessions.get(turn.chatId);
    let isNew = false;

    this.stopRequested.delete(turn.chatId);

    // The effort is fixed when the process starts; the model can change in a running session.
    if (session && session.effort !== turn.effort) {
      onEvent({ kind: "text", text: "_(Muse started a new conversation for the new effort.)_" });
      this.close(turn.chatId);
      session = undefined;
    }

    try {
      if (!session) {
        session = await this.start(turn);
        isNew = true;
      } else if (session.model !== turn.model && turn.model) {
        await this.request(session, "session/set_config_option", {
          sessionId: session.sessionId,
          configId: "model",
          value: turn.model,
        });
        session.model = turn.model;
      }
    } catch (error) {
      // A session that did not get ready would otherwise stay, with its process, for the next turn.
      this.close(turn.chatId);
      onEvent({ kind: "done", error: error instanceof Error ? error.message : String(error) });

      return;
    }

    // Stopped while the process and its session were being made: nothing to cancel then, so no prompt.
    if (this.stopRequested.delete(turn.chatId)) {
      onEvent({ kind: "done", error: "Stopped." });

      return;
    }

    session.onEvent = onEvent;
    session.bufferedText = "";

    // Muse has no setting for a system prompt: it goes ahead of the first message.
    const text = isNew ? `${turn.systemPrompt}\n\n---\n\nThe user's message:\n\n${turn.prompt}` : turn.prompt;

    try {
      const result = await this.request(session, "session/prompt", {
        sessionId: session.sessionId,
        prompt: [{ type: "text", text }],
      });

      this.flush(session);
      onEvent(result?.stopReason === "cancelled" ? { kind: "done", error: "Stopped." } : { kind: "done" });
    } catch (error) {
      this.flush(session);
      onEvent({ kind: "done", error: error instanceof Error ? error.message : String(error) });
    } finally {
      session.onEvent = undefined;
    }
  }

  stop(chatId: string) {
    const session = this.sessions.get(chatId);

    if (session?.sessionId) {
      this.notify(session, "session/cancel", { sessionId: session.sessionId });
    } else {
      this.stopRequested.add(chatId);
    }
  }

  close(chatId: string) {
    const session = this.sessions.get(chatId);

    if (session) {
      this.sessions.delete(chatId);
      session.child.kill();
      void session.host.remove(session.workspace).catch(() => {});

      for (const { reject } of session.pending.values()) {
        reject(new Error("Muse stopped."));
      }
    }
  }

  private async start(turn: MuseTurn): Promise<MuseSession> {
    const host = this.dependencies.host();
    const { workDir, emptyKubeconfig } = await host.workDir();
    // Freelens's MCP server as the host reaches it: itself, or through the SSH connection.
    const mcpUrl = await host.mcpUrl(turn.mcpUrl);
    const workspace = await prepareMuseWorkspace(host, workDir, turn.chatId, mcpUrl);
    const child = await host
      .spawn(
        turn.command,
        [
          "acp",
          "--no-session-log",
          // Reads the workspace's .mcp.json, for this run only.
          "--trust-workspace",
          "--disable-shell",
          "--disable-write",
          "--disable-request-user-input",
          ...(turn.model ? ["--model", turn.model] : []),
          ...(turn.effort ? ["-c", `reasoning_effort=${JSON.stringify(turn.effort)}`] : []),
        ],
        {
          cwd: workspace,
          env: { KUBECONFIG: emptyKubeconfig, [museMcpAuthVariable]: `Bearer ${turn.mcpToken}` },
          readsStdin: true,
        },
      )
      .catch((error) => {
        void host.remove(workspace).catch(() => {});
        throw error;
      });
    const session: MuseSession = {
      child,
      host,
      workspace,
      effort: turn.effort,
      model: turn.model,
      nextId: 1,
      pending: new Map(),
      bufferedText: "",
      toolCalls: new Map(),
    };
    let stderrTail = "";

    this.sessions.set(turn.chatId, session);

    child.stderr?.on("data", (chunk: Buffer) => {
      stderrTail = (stderrTail + chunk.toString("utf8")).slice(-2000);
    });
    child.on("error", (error: NodeJS.ErrnoException) =>
      this.fail(
        turn.chatId,
        session,
        error.code === "ENOENT" ? `Freelens could not find "${turn.command}".` : error.message,
      ),
    );
    child.on("close", () => this.fail(turn.chatId, session, stderrTail.trim() || "Muse exited."));

    if (child.stdout) {
      createInterface({ input: child.stdout }).on("line", (line) => this.receive(session, line));
    }

    await this.request(session, "initialize", { protocolVersion: 1, clientCapabilities: {} });

    // The MCP server comes from the workspace's .mcp.json: Muse does not connect to the ones ACP passes.
    const created = await this.request(session, "session/new", { cwd: workspace, mcpServers: [] });

    session.sessionId = created?.sessionId;

    return session;
  }

  private fail(chatId: string, session: MuseSession, message: string) {
    if (this.sessions.get(chatId) === session) {
      this.sessions.delete(chatId);
    }

    // The process is gone on its own: its workspace has no more use.
    void session.host.remove(session.workspace).catch(() => {});

    for (const { reject } of session.pending.values()) {
      reject(new Error(message));
    }

    session.pending.clear();
  }

  private flush(session: MuseSession) {
    if (session.bufferedText.trim()) {
      session.onEvent?.({ kind: "text", text: session.bufferedText });
    }

    session.bufferedText = "";
  }

  private receive(session: MuseSession, line: string) {
    let message: JsonRpcMessage;

    try {
      message = JSON.parse(line) as JsonRpcMessage;
    } catch {
      return;
    }

    // A request from Muse to Freelens.
    if (message.method && message.id !== undefined) {
      if (message.method === "session/request_permission") {
        const toolCallId = (message.params as { toolCall?: MuseToolCall } | undefined)?.toolCall?.toolCallId;
        const optionId = choosePermissionOption(
          message.params,
          toolCallId ? session.toolCalls.get(toolCallId) : undefined,
        );
        const asked = { ...(toolCallId ? session.toolCalls.get(toolCallId) : {}), ...(message.params?.toolCall ?? {}) };

        if (!optionId?.startsWith("allow")) {
          this.dependencies.logWarn(`[AI-CHAT]: refused Muse's tool call ${JSON.stringify(asked)}`);
        }

        this.send(session, {
          jsonrpc: "2.0",
          id: message.id,
          result: { outcome: optionId ? { outcome: "selected", optionId } : { outcome: "cancelled" } },
        });
      } else {
        this.send(session, {
          jsonrpc: "2.0",
          id: message.id,
          error: { message: `Freelens does not offer ${message.method}` },
        });
      }

      return;
    }

    // A notification: the agent's progress.
    if (message.method) {
      if (message.method === "session/update") {
        const update = message.params?.update;

        if (
          (update?.sessionUpdate === "tool_call" || update?.sessionUpdate === "tool_call_update") &&
          typeof update.toolCallId === "string"
        ) {
          session.toolCalls.set(update.toolCallId, {
            ...session.toolCalls.get(update.toolCallId),
            ...withoutEmpty(update as MuseToolCall),
          });
        }

        // Text arrives in chunks; a tool call or any other update ends a paragraph.
        for (const event of parseMuseUpdate(message.params)) {
          if (event.kind === "text") {
            session.bufferedText += event.text;
          }
        }

        if (update?.sessionUpdate && update.sessionUpdate !== "agent_message_chunk") {
          this.flush(session);
        }
      }

      return;
    }

    // A response to a request of Freelens.
    if (typeof message.id === "number") {
      const pending = session.pending.get(message.id);

      if (pending) {
        session.pending.delete(message.id);

        if (message.error) {
          pending.reject(new Error(message.error.message ?? "Muse reported an error"));
        } else {
          pending.resolve(message.result);
        }
      }
    }
  }

  private request(session: MuseSession, method: string, params: unknown): Promise<any> {
    const id = session.nextId++;

    return new Promise((resolve, reject) => {
      session.pending.set(id, { resolve, reject });
      this.send(session, { jsonrpc: "2.0", id, method, params });
    });
  }

  private notify(session: MuseSession, method: string, params: unknown) {
    this.send(session, { jsonrpc: "2.0", method, params });
  }

  private send(session: MuseSession, message: JsonRpcMessage) {
    session.child.stdin?.write(`${JSON.stringify(message)}\n`);
  }
}
