/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { execFile, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runEndedByStdin, SshCliHost, workDirScript } from "./ssh-cli-host";
import type { ChildProcess } from "node:child_process";

import type { Spawn } from "../../../../main/child-process/spawn.injectable";
import type { SshAskpass } from "./ssh-askpass";

/** A spawn of ssh that answers each call from `reply` and records its arguments. */
const fakeSsh = (reply: (args: string[]) => { code: number; stdout?: string }) => {
  const calls: string[][] = [];
  const spawnSsh = ((_command: string, args: string[]) => {
    calls.push(args);

    const child = new EventEmitter() as ChildProcess;
    const stdout = new EventEmitter();
    const { code, stdout: output = "" } = reply(args);

    Object.assign(child, { stdout, stderr: new EventEmitter(), stdin: { end: () => {} }, kill: () => true });
    setImmediate(() => {
      stdout.emit("data", Buffer.from(output));
      child.emit("exit", code);
    });

    return child;
  }) as unknown as Spawn;

  return { calls, spawnSsh };
};

const askpass = { environment: () => ({}), during: (work: () => Promise<unknown>) => work() } as unknown as SshAskpass;

const hostWith = (spawnSsh: Spawn) =>
  new SshCliHost(
    { destination: "dev.example.com", port: "2222", identityFile: "", configFile: "" },
    { spawn: spawnSsh, env: () => ({}), askpass, controlDir: tmpdir(), platform: "linux", logInfo: () => {} },
  );

describe("SshCliHost", () => {
  it("forwards the MCP port again after an attempt that never ran ssh", async () => {
    let forwards = 0;
    const spawnSsh = ((_command: string, args: string[]) => {
      const child = new EventEmitter() as ChildProcess;
      const stdout = new EventEmitter();
      const isForward = args.includes("forward");

      Object.assign(child, { stdout, stderr: new EventEmitter(), stdin: { end: () => {} }, kill: () => true });
      setImmediate(() => {
        if (isForward && forwards++ === 0) {
          child.emit("error", Object.assign(new Error("spawn ssh EAGAIN"), { code: "EAGAIN" }));
        } else {
          stdout.emit("data", Buffer.from(isForward ? "40123\n" : ""));
          child.emit("exit", 0);
        }
      });

      return child;
    }) as unknown as Spawn;
    const host = hostWith(spawnSsh);

    await expect(host.mcpUrl("http://127.0.0.1:5000/mcp/c")).rejects.toThrow("EAGAIN");
    await expect(host.mcpUrl("http://127.0.0.1:5000/mcp/c")).resolves.toBe("http://127.0.0.1:40123/mcp/c");
  });

  it("names the host after the options and before the command to run there", async () => {
    const { calls, spawnSsh } = fakeSsh(() => ({ code: 0, stdout: "/home/me/.local/bin/claude\n" }));

    await expect(hostWith(spawnSsh).resolveCommand("claude", "")).resolves.toBe("/home/me/.local/bin/claude");

    const run = calls.at(-1)!;
    const at = run.indexOf("dev.example.com");

    expect(run.slice(0, 2)).toEqual(["-p", "2222"]);
    expect(run[at - 1]).toBe("--");
    expect(run.slice(at + 1)).toHaveLength(1);
    expect(run[at + 1]).toMatch(/^\/bin\/sh -c /);
  });

  it("forwards a port of the host to Freelens's tools once per connection", async () => {
    const { calls, spawnSsh } = fakeSsh((args) => ({ code: 0, stdout: args.includes("forward") ? "40123\n" : "" }));
    const host = hostWith(spawnSsh);

    await expect(host.mcpUrl("http://127.0.0.1:5555/mcp/chat-1")).resolves.toBe("http://127.0.0.1:40123/mcp/chat-1");
    await expect(host.mcpUrl("http://127.0.0.1:5555/mcp/chat-2")).resolves.toBe("http://127.0.0.1:40123/mcp/chat-2");
    expect(calls.filter((args) => args.includes("forward"))).toHaveLength(1);
    expect(calls.find((args) => args.includes("forward"))).toContain("0:127.0.0.1:5555");
  });
});

describe("the scripts run on the host", () => {
  let dir: string;

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("runs a command with the variables of its file, and ends it and its children when stdin closes", async () => {
    dir = mkdtempSync(path.join(tmpdir(), "ssh-run-"));
    writeFileSync(path.join(dir, ".env-1"), "GREETING='hello there'\n");

    const marker = path.join(dir, "child-alive");
    const child = spawn(
      "/bin/sh",
      [
        "-c",
        runEndedByStdin,
        "sh",
        dir,
        ".env-1",
        "sh",
        "-c",
        `echo "$GREETING"; (sleep 30; touch '${marker}') & wait`,
      ],
      { env: { ...process.env, SHELL: "/bin/sh" }, stdio: ["pipe", "pipe", "pipe"] },
    );
    const firstLine = await new Promise<string>((resolve) =>
      child.stdout.once("data", (chunk) => resolve(String(chunk))),
    );
    const startedAt = Date.now();
    const exited = new Promise((resolve) => child.on("exit", resolve));

    child.stdin.end();
    await exited;

    expect(firstLine.trim()).toBe("hello there");
    expect(Date.now() - startedAt).toBeLessThan(5000);
    expect(existsSync(path.join(dir, ".env-1"))).toBe(false);
    // The grandchild was ended with it, rather than left to keep the connection open.
    await new Promise((resolve) => setTimeout(resolve, 300));
    await expect(pgrep(`touch '${marker}'`)).resolves.toBe("");
  });

  const runWorkDir = (env: Record<string, string>) =>
    new Promise<{ code: number; stdout: string }>((resolve) => {
      const { XDG_RUNTIME_DIR: _ignored, ...rest } = process.env;

      execFile("/bin/sh", ["-c", workDirScript], { env: { ...rest, ...env } }, (error, stdout) =>
        resolve({ code: error ? 1 : 0, stdout }),
      );
    });

  it("keeps the CLIs' directory private, out of the home directory", async () => {
    dir = mkdtempSync(path.join(tmpdir(), "ssh-workdir-"));

    const { code, stdout } = await runWorkDir({ TMPDIR: `${dir}/` });
    const workDir = path.join(dir, `freelens-ai-${process.getuid?.()}`);

    expect(code).toBe(0);
    expect(stdout).toBe(workDir);
    expect(statSync(workDir).mode & 0o777).toBe(0o700);
    expect(existsSync(path.join(workDir, "no-cluster.kubeconfig"))).toBe(true);
  });

  it("prefers the user's runtime directory", async () => {
    dir = mkdtempSync(path.join(tmpdir(), "ssh-workdir-"));

    const { stdout } = await runWorkDir({ XDG_RUNTIME_DIR: dir });

    expect(stdout).toBe(path.join(dir, "freelens-ai"));
  });

  it("refuses a link planted where the directory goes", async () => {
    dir = mkdtempSync(path.join(tmpdir(), "ssh-workdir-"));
    mkdirSync(path.join(dir, "elsewhere"));
    symlinkSync(path.join(dir, "elsewhere"), path.join(dir, `freelens-ai-${process.getuid?.()}`));

    await expect(runWorkDir({ TMPDIR: dir })).resolves.toMatchObject({ code: 1, stdout: "" });
  });
});

const pgrep = (pattern: string) =>
  new Promise<string>((resolve) => execFile("pgrep", ["-f", pattern], (_error, stdout) => resolve(stdout)));
