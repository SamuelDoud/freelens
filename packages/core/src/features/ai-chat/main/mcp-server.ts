/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { randomBytes, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { findAiTool, getAvailableAiTools } from "../common/tools";
import type { IncomingMessage, Server, ServerResponse } from "node:http";

import type { AiToolResult } from "../common/channels";

export interface AiMcpServerDependencies {
  /** Whether a chat allows changes: the change tools are listed only then. */
  allowsChanges: (chatId: string) => boolean;
  /** Runs a tool for a chat: the chat host checks the call, asks for approval and runs it in the cluster frame. */
  callTool: (chatId: string, name: string, args: unknown) => Promise<AiToolResult>;
  logError: (message: string, error?: unknown) => void;
}

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

const maxBodyBytes = 1024 * 1024;

/**
 * A Model Context Protocol server (streamable HTTP, JSON responses only) that offers Freelens's
 * tools to the command-line agents. It listens on the loopback interface only, wants a bearer token
 * that changes with every start of Freelens, and serves each chat at its own path, so that it
 * lists and runs the change tools only for a chat that allows changes.
 */
export class AiMcpServer {
  readonly token = randomBytes(32).toString("hex");

  private server?: Server;
  private listening?: Promise<number>;

  constructor(private readonly dependencies: AiMcpServerDependencies) {}

  /** The URL of a chat's endpoint, starting the server on first use. */
  async urlFor(chatId: string): Promise<string> {
    const port = await this.listen();

    return `http://127.0.0.1:${port}/mcp/${encodeURIComponent(chatId)}`;
  }

  close() {
    this.server?.close();
    this.server = undefined;
    this.listening = undefined;
  }

  private listen(): Promise<number> {
    this.listening ??= new Promise<number>((resolve, reject) => {
      const server = createServer((req, res) => {
        this.handle(req, res).catch((error) => {
          this.dependencies.logError("[AI-CHAT]: MCP request failed", error);

          if (!res.headersSent) {
            res.writeHead(500).end();
          }
        });
      });

      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();

        if (address && typeof address === "object") {
          this.server = server;
          resolve(address.port);
        } else {
          reject(new Error("The MCP server has no port"));
        }
      });
    });

    return this.listening;
  }

  private isAuthorized(req: IncomingMessage) {
    const expected = Buffer.from(`Bearer ${this.token}`);
    const actual = Buffer.from(req.headers.authorization ?? "");

    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  private async handle(req: IncomingMessage, res: ServerResponse) {
    const match = /^\/mcp\/([^/?]+)/.exec(req.url ?? "");

    if (!match) {
      res.writeHead(404).end();

      return;
    }

    if (!this.isAuthorized(req)) {
      res.writeHead(401).end();

      return;
    }

    if (req.method === "DELETE") {
      res.writeHead(200).end();

      return;
    }

    // No server-initiated stream: the server never sends requests or notifications of its own.
    if (req.method !== "POST") {
      res.writeHead(405, { Allow: "POST, DELETE" }).end();

      return;
    }

    const chatId = decodeURIComponent(match[1]);
    let message: JsonRpcRequest | JsonRpcRequest[];

    try {
      message = JSON.parse(await readBody(req)) as JsonRpcRequest | JsonRpcRequest[];
    } catch {
      sendJson(res, 400, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });

      return;
    }

    const requests = Array.isArray(message) ? message : [message];
    const responses = (await Promise.all(requests.map((request) => this.answer(chatId, request)))).filter(
      (response) => response !== undefined,
    );

    if (responses.length === 0) {
      res.writeHead(202).end();
    } else {
      sendJson(res, 200, Array.isArray(message) ? responses : responses[0]);
    }
  }

  private async answer(chatId: string, request: JsonRpcRequest) {
    // A notification gets no answer.
    if (request.id === undefined || request.id === null) {
      return undefined;
    }

    const respond = (result: unknown) => ({ jsonrpc: "2.0", id: request.id, result });
    const allowChanges = this.dependencies.allowsChanges(chatId);

    switch (request.method) {
      case "initialize":
        return respond({
          protocolVersion:
            typeof request.params?.protocolVersion === "string" ? request.params.protocolVersion : "2025-06-18",
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "freelens", version: "1" },
        });
      case "ping":
        return respond({});
      case "tools/list":
        return respond({
          tools: getAvailableAiTools(allowChanges).map(({ name, description, inputSchema }) => ({
            name,
            description,
            inputSchema,
          })),
        });
      case "tools/call": {
        const name = String(request.params?.name ?? "");
        const tool = findAiTool(name);
        const result: AiToolResult = !tool
          ? { ok: false, text: `There is no tool ${name}.` }
          : tool.access === "change" && !allowChanges
            ? { ok: false, text: 'Changes are not allowed in this chat: the user has to tick "Allow changes".' }
            : await this.dependencies.callTool(chatId, name, request.params?.arguments ?? {});

        return respond({ content: [{ type: "text", text: result.text }], isError: !result.ok });
      }
      default:
        return { jsonrpc: "2.0", id: request.id, error: { code: -32601, message: `Unknown method ${request.method}` } };
    }
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;

    req.on("data", (chunk: Buffer) => {
      size += chunk.length;

      if (size > maxBodyBytes) {
        reject(new Error("The request is too large"));
        req.destroy();
      } else {
        chunks.push(chunk);
      }
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body));
}
