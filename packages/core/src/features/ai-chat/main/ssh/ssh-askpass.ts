/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { chmodSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

/** What ssh asks: a secret (a password, a passphrase, a passcode), a confirmation (yes or no), or other text. */
export type SshPromptKind = "secret" | "confirm" | "text";

export interface SshPrompt {
  readonly id: string;
  readonly kind: SshPromptKind;
  readonly text: string;
}

/** The answer to a prompt, or undefined when the user cancelled it. */
export type AnswerSshPrompt = (prompt: SshPrompt) => Promise<string | undefined>;

// The askpass program ssh runs for each prompt: plain POSIX sh, so that it needs nothing installed.
// It hands the prompt to Freelens as a file and waits for the answer as another; the directory is
// the user's alone. A prompt not answered within ten minutes is cancelled.
const askpassScript = `#!/bin/sh
# Freelens: passes a prompt of ssh to the app, and prints the answer.
dir="$FREELENS_ASKPASS_DIR"
id="$$-$(date +%s)"
umask 077
printf '%s\\n%s' "\${SSH_ASKPASS_PROMPT:-}" "$1" > "$dir/$id.prompt.tmp" && mv "$dir/$id.prompt.tmp" "$dir/$id.prompt" || exit 1
i=0
while [ "$i" -lt 3000 ]; do
  if [ -f "$dir/$id.answer" ]; then
    cat "$dir/$id.answer"
    rm -f "$dir/$id.answer"
    exit 0
  fi
  if [ -f "$dir/$id.cancel" ]; then
    rm -f "$dir/$id.cancel"
    exit 1
  fi
  sleep 0.2
  i=$((i + 1))
done
rm -f "$dir/$id.prompt"
exit 1
`;

const pollMs = 200;

/** The kind of a prompt, from what ssh says and how it asks. */
export function classifySshPrompt(askpassPrompt: string, text: string): SshPromptKind {
  if (askpassPrompt === "confirm" || /\(yes\/no(\/\[fingerprint\])?\)\??\s*$/i.test(text)) {
    return "confirm";
  }

  // Passwords, key passphrases, one-time passcodes and verification codes are not shown as typed.
  // Duo's "Passcode or option (1-3):" takes an option as often as a passcode, so it is shown.
  if (/passcode or option/i.test(text)) {
    return "text";
  }

  return /password|passphrase|passcode|pin|token|verification code|one-time/i.test(text) ? "secret" : "text";
}

/**
 * Answers the prompts of ssh through the user: ssh runs the askpass program for every question
 * it has (a host key, a key's passphrase, a password, the codes of a second factor such as Duo),
 * which hands it to Freelens to ask in a dialog.
 */
export class SshAskpass {
  private readonly answering = new Set<string>();
  private timer?: ReturnType<typeof setInterval>;
  private users = 0;

  constructor(
    private readonly baseDir: string,
    private readonly answer: AnswerSshPrompt,
  ) {}

  /** The askpass program and the environment that makes ssh use it, whether or not it has a terminal. */
  environment(): Record<string, string> {
    const dir = this.promptsDir();
    const program = path.join(this.baseDir, "askpass.sh");

    mkdirSync(dir, { recursive: true, mode: 0o700 });
    writeFileSync(program, askpassScript, { mode: 0o700 });
    chmodSync(program, 0o700);

    return {
      SSH_ASKPASS: program,
      SSH_ASKPASS_REQUIRE: "force",
      // Older ssh only runs the askpass program with a display set.
      DISPLAY: process.env.DISPLAY ?? ":0",
      FREELENS_ASKPASS_DIR: dir,
    };
  }

  /** Watches for prompts while `work` runs. */
  async during<T>(work: () => Promise<T>): Promise<T> {
    this.users++;
    this.timer ??= setInterval(() => this.poll(), pollMs);

    try {
      return await work();
    } finally {
      this.users--;

      if (this.users === 0) {
        clearInterval(this.timer);
        this.timer = undefined;
      }
    }
  }

  private promptsDir() {
    return path.join(this.baseDir, "prompts");
  }

  private poll() {
    const dir = this.promptsDir();
    let files: string[];

    try {
      files = readdirSync(dir);
    } catch {
      return;
    }

    for (const file of files.filter((name) => name.endsWith(".prompt"))) {
      const id = file.slice(0, -".prompt".length);

      if (this.answering.has(id)) {
        continue;
      }

      this.answering.add(id);

      const raw = readFileSync(path.join(dir, file), "utf8");
      const newline = raw.indexOf("\n");
      const askpassPrompt = newline >= 0 ? raw.slice(0, newline) : "";
      const text = newline >= 0 ? raw.slice(newline + 1) : raw;

      rmSync(path.join(dir, file), { force: true });

      void this.answer({ id, kind: classifySshPrompt(askpassPrompt, text), text: text.trim() })
        .then((answer) => {
          if (answer === undefined) {
            writeFileSync(path.join(dir, `${id}.cancel`), "", { mode: 0o600 });
          } else {
            // Written whole before the script can see it.
            writeFileSync(path.join(dir, `${id}.answer.tmp`), answer, { mode: 0o600 });
            renameSync(path.join(dir, `${id}.answer.tmp`), path.join(dir, `${id}.answer`));
          }
        })
        .catch(() => writeFileSync(path.join(dir, `${id}.cancel`), "", { mode: 0o600 }))
        .finally(() => this.answering.delete(id));
    }
  }
}
