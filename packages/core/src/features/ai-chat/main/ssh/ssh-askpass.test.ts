/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { execFile } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { classifySshPrompt, SshAskpass } from "./ssh-askpass";

const runAskpass = (env: Record<string, string>, prompt: string, extra: Record<string, string> = {}) =>
  new Promise<{ code: number | null; stdout: string }>((resolve) => {
    execFile(env.SSH_ASKPASS, [prompt], { env: { ...process.env, ...env, ...extra } }, (error, stdout) =>
      resolve({ code: error ? ((error as { code?: number }).code ?? 1) : 0, stdout }),
    );
  });

describe("SshAskpass", () => {
  let dir: string;

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("hands the prompt of ssh to the user and the answer back", async () => {
    dir = mkdtempSync(path.join(tmpdir(), "askpass-"));
    const asked: unknown[] = [];
    const askpass = new SshAskpass(dir, async (prompt) => {
      asked.push(prompt);

      return "1";
    });
    const env = askpass.environment();
    const duo = "Duo two-factor login for sam\n\n 1. Duo Push to XXX-XXX-1234\n\nPasscode or option (1-1): ";
    const result = await askpass.during(() => runAskpass(env, duo));

    expect(result).toEqual({ code: 0, stdout: "1" });
    expect(asked).toEqual([{ id: expect.any(String), kind: "text", text: duo.trim() }]);
  });

  it("fails the prompt the user cancels", async () => {
    dir = mkdtempSync(path.join(tmpdir(), "askpass-"));
    const askpass = new SshAskpass(dir, async () => undefined);
    const env = askpass.environment();
    const result = await askpass.during(() =>
      runAskpass(env, "Are you sure you want to continue connecting (yes/no/[fingerprint])?"),
    );

    expect(result.code).not.toBe(0);
  });
});

describe("classifySshPrompt", () => {
  it("tells secrets, confirmations and Duo's options apart", () => {
    expect(classifySshPrompt("", "sam@devvm's password: ")).toBe("secret");
    expect(classifySshPrompt("", "Enter passphrase for key '/home/sam/.ssh/id_ed25519': ")).toBe("secret");
    expect(classifySshPrompt("", "Are you sure you want to continue connecting (yes/no/[fingerprint])?")).toBe(
      "confirm",
    );
    expect(classifySshPrompt("confirm", "Allow use of key?")).toBe("confirm");
    expect(classifySshPrompt("", "Passcode or option (1-3): ")).toBe("text");
    expect(classifySshPrompt("", "Verification code: ")).toBe("secret");
  });
});
