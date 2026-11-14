/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiMcpServer } from "./mcp-server";

import type { Mock } from "vitest";

import type { AiMcpServerDependencies } from "./mcp-server";

describe("AiMcpServer", () => {
  let server: AiMcpServer;
  let sendToolCall: Mock<AiMcpServerDependencies["sendToolCall"]>;
  let url: string;

  const rpc = async (method: string, params?: unknown, token = server.token) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });

    return { status: response.status, body: response.status === 200 ? await response.json() : undefined };
  };

  const toolNames = async () =>
    ((await rpc("tools/list")).body.result.tools as { name: string }[]).map(({ name }) => name);

  beforeEach(async () => {
    sendToolCall = vi.fn<AiMcpServerDependencies["sendToolCall"]>();
    server = new AiMcpServer({ sendToolCall, logError: () => {} });
    url = await server.urlFor("chat-1");
  });

  afterEach(() => server.close());

  it("listens on the loopback interface, at the chat's path", () => {
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/mcp\/chat-1$/);
  });

  it("refuses a request without the token", async () => {
    expect((await rpc("tools/list", undefined, "wrong")).status).toBe(401);
  });

  it("answers the initialize handshake and ignores notifications", async () => {
    const { body } = await rpc("initialize", { protocolVersion: "2025-06-18" });

    expect(body.result.serverInfo.name).toBe("freelens");
    expect(body.result.capabilities.tools).toBeDefined();

    const notification = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${server.token}` },
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    });

    expect(notification.status).toBe(202);
  });

  it("lists the change tools only while the chat allows changes", async () => {
    expect(await toolNames()).not.toContain("delete_resource");
    expect(await toolNames()).toContain("list_resources");

    server.setAllowChanges("chat-1", true);

    expect(await toolNames()).toEqual(expect.arrayContaining(["delete_resource", "scale_workload", "list_resources"]));
  });

  it("refuses a change tool for a chat that does not allow changes, without asking the frame", async () => {
    const { body } = await rpc("tools/call", { name: "delete_resource", arguments: { kind: "Pod", name: "p" } });

    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toMatch(/Allow changes/);
    expect(sendToolCall).not.toHaveBeenCalled();
  });

  it("hands a tool call to the chat's frame and answers with its result", async () => {
    sendToolCall.mockImplementation(({ callId }) => server.resolveToolCall(callId, { ok: true, text: "3 Pods" }));

    const { body } = await rpc("tools/call", { name: "list_resources", arguments: { kind: "Pod" } });

    expect(sendToolCall).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: "chat-1", name: "list_resources", args: { kind: "Pod" } }),
    );
    expect(body.result).toEqual({ content: [{ type: "text", text: "3 Pods" }], isError: false });
  });

  it("answers an unknown method with an error", async () => {
    expect((await rpc("resources/list")).body.error.code).toBe(-32601);
  });
});
