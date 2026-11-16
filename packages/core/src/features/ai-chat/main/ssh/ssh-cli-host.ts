/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { shellCommand, shellQuote } from "./shell-quote";
import type { ChildProcess } from "node:child_process";

import type { Spawn } from "../../../../main/child-process/spawn.injectable";
import type { AiCliHost, AiCliHostSpawnOptions } from "../cli-host";
import type { SshAskpass } from "./ssh-askpass";

/** How to reach the host, as the user set it; empty fields leave it to their SSH configuration. */
export interface SshTarget {
  /** A DNS name, an address or an alias of the SSH configuration, with or without "user@" */
  readonly destination: string;
  readonly port: string;
  readonly identityFile: string;
  /** An SSH configuration file other than ~/.ssh/config */
  readonly configFile: string;
}

export interface SshCliHostDependencies {
  spawn: Spawn;
  env: () => NodeJS.ProcessEnv;
  askpass: SshAskpass;
  /** Where the shared connections' sockets live: short, as a socket path is limited to about 100 characters */
  controlDir: string;
  platform: NodeJS.Platform;
  logInfo: (message: string) => void;
}

interface SshResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

// The login shell runs the commands, so that its profile sets the PATH the CLIs are on, as in a
// terminal. fish does not take POSIX arguments the same way, so it gets sh instead.
const loginShell = `case "\${SHELL:-}" in *fish|"") s=/bin/sh ;; *) s=$SHELL ;; esac`;

// Runs a command that does not read its stdin, ending it when the stdin closes: closing the
// connection's stdin is how a stopped turn ends on the host.
export const runEndedByStdin = `cd "$1" || exit 1
set -a; . "./$2"; set +a; rm -f "./$2"
shift 2
${loginShell}
# A background job's stdin is /dev/null unless redirected, so the watcher gets the connection's
# through descriptor 3, which the command does not inherit.
exec 3<&0
"$s" -l -c 'exec "$0" "$@"' "$@" </dev/null 3<&- &
child=$!
# Ends the command and what it started, which would otherwise keep the connection open.
tree() { echo "$1"; for c in $(pgrep -P "$1" 2>/dev/null); do tree "$c"; done; }
end() { kill -TERM $(tree "$child") 2>/dev/null; }
trap end HUP INT TERM
( cat <&3 >/dev/null; end ) >/dev/null 2>&1 &
exec 3<&-
watcher=$!
wait "$child"
status=$?
kill "$watcher" 2>/dev/null
exit "$status"`;

// Runs a command that reads its stdin: it ends when the stdin does.
const runReadingStdin = `cd "$1" || exit 1
set -a; . "./$2"; set +a; rm -f "./$2"
shift 2
${loginShell}
exec "$s" -l -c 'exec "$0" "$@"' "$@"`;

// The directory the CLIs run in, where Freelens's token is written. Not under the home directory,
// which may be on a network share whose ACLs ignore the file modes: the user's runtime directory
// (a tmpfs only they can read) where there is one, else theirs in the temporary directory, if it is
// a real directory of theirs. It stays the same from turn to turn, as Claude Code keeps its
// sessions by directory.
export const workDirScript = `if [ -n "\${XDG_RUNTIME_DIR:-}" ] && [ -d "$XDG_RUNTIME_DIR" ] && [ -O "$XDG_RUNTIME_DIR" ]; then
  d=$XDG_RUNTIME_DIR/freelens-ai
else
  d=\${TMPDIR:-/tmp}; d=\${d%/}/freelens-ai-$(id -u)
fi
umask 077
mkdir -p "$d" || exit 1
if [ -L "$d" ] || [ ! -O "$d" ]; then echo "$d is not a directory of this user." >&2; exit 1; fi
chmod 700 "$d" && : > "$d/no-cluster.kubeconfig" && printf %s "$d"`;

const timeoutMs = 60_000;
// Long enough to find a phone and approve a push of a second factor.
const connectTimeoutMs = 10 * 60_000;

/** The last lines of what ssh said, without its warnings about how it connected. */
const sshError = (stderr: string) =>
  stderr
    .split(/\r?\n/)
    .filter((line) => line.trim() && !/^Warning: Permanently added/.test(line))
    .slice(-3)
    .join("\n");

/**
 * Another host, over the system's ssh: the user's own configuration, keys and agent apply. The
 * first connection asks for whatever the host wants (a host key, a passphrase, a password, the
 * codes of a second factor such as Duo) and stays open, shared, for eight hours, so that the turns
 * after it do not ask again. Freelens's MCP server reaches the host through a forward of that
 * connection.
 */
export class SshCliHost implements AiCliHost {
  readonly remote = true;
  private connecting?: Promise<void>;
  private dir?: Promise<{ workDir: string; emptyKubeconfig: string }>;
  /** The host's ports of Freelens's ports, forwarded over the current shared connection */
  private readonly forwarded = new Map<number, Promise<number>>();

  constructor(
    private readonly target: SshTarget,
    private readonly dependencies: SshCliHostDependencies,
  ) {}

  get label() {
    return this.target.destination;
  }

  /** The arguments of ssh: the options, the extra ones, the host, then the command to run there if any. */
  private args(extra: string[] = [], command?: string): string[] {
    const { configFile, port, identityFile, destination } = this.target;

    return [
      ...(configFile ? ["-F", configFile] : []),
      ...(port ? ["-p", port] : []),
      ...(identityFile ? ["-i", identityFile, "-o", "IdentitiesOnly=yes"] : []),
      "-o",
      "ControlMaster=auto",
      "-o",
      `ControlPath=${path.join(this.dependencies.controlDir, "%C")}`,
      "-o",
      "ControlPersist=8h",
      "-o",
      "ServerAliveInterval=30",
      "-o",
      "ConnectTimeout=20",
      ...extra,
      // The destination ends the options, so that one starting with "-" cannot pass for one.
      "--",
      destination,
      ...(command === undefined ? [] : [command]),
    ];
  }

  private env() {
    return { ...this.dependencies.env(), ...this.dependencies.askpass.environment() };
  }

  private ssh(args: string[], { input, timeout = timeoutMs }: { input?: string; timeout?: number } = {}) {
    return this.dependencies.askpass.during(
      () =>
        new Promise<SshResult>((resolve, reject) => {
          const child = this.dependencies.spawn("ssh", args, { env: this.env(), stdio: ["pipe", "pipe", "pipe"] });
          let stdout = "";
          let stderr = "";
          const timer = setTimeout(() => {
            child.kill();
            reject(new Error(`ssh to ${this.label} did not answer in time.`));
          }, timeout);

          child.stdout?.on("data", (chunk: Buffer) => {
            stdout += chunk.toString("utf8");
          });
          child.stderr?.on("data", (chunk: Buffer) => {
            stderr += chunk.toString("utf8");
          });
          child.on("error", (error: NodeJS.ErrnoException) => {
            clearTimeout(timer);
            reject(new Error(error.code === "ENOENT" ? "Freelens could not find the ssh command." : error.message));
          });
          // "exit" rather than "close": a shared connection started in the background keeps the pipes open.
          child.on("exit", (code) => {
            clearTimeout(timer);
            setImmediate(() => resolve({ code, stdout, stderr }));
          });
          child.stdin?.end(input);
        }),
    );
  }

  /** Runs a POSIX sh script on the host, with its arguments and its stdin. */
  private async run(script: string, args: string[] = [], input?: string): Promise<SshResult> {
    await this.connect();

    return this.ssh(this.args(["-T"], shellCommand(["/bin/sh", "-c", script, "sh", ...args])), { input });
  }

  private async runOrThrow(script: string, args: string[] = [], input?: string) {
    const result = await this.run(script, args, input);

    if (result.code !== 0) {
      throw new Error(sshError(result.stderr) || `A command on ${this.label} failed with code ${result.code}.`);
    }

    return result.stdout;
  }

  connect(): Promise<void> {
    this.connecting ??= this.openConnection().finally(() => {
      this.connecting = undefined;
    });

    return this.connecting;
  }

  private async openConnection() {
    if (this.dependencies.platform === "win32") {
      // Without a shared connection, every command would log in again, and ask for Duo each time.
      throw new Error(
        "Running the AI CLIs on another host needs macOS or Linux: Windows's ssh cannot share a connection.",
      );
    }

    mkdirSync(this.dependencies.controlDir, { recursive: true, mode: 0o700 });

    if ((await this.ssh(this.args(["-O", "check"]))).code === 0) {
      return;
    }

    // A new shared connection: the forwards of the one before are gone with it.
    this.forwarded.clear();
    this.dependencies.logInfo(`[AI-CHAT]: connecting to ${this.label} over ssh`);

    // Asks what it has to in the foreground, then keeps the connection open in the background.
    const result = await this.ssh(this.args(["-f", "-N"]), { timeout: connectTimeoutMs });

    if (result.code !== 0) {
      throw new Error(sshError(result.stderr) || `ssh to ${this.label} failed with code ${result.code}.`);
    }
  }

  workDir() {
    this.dir ??= this.runOrThrow(workDirScript)
      .then((stdout) => {
        const workDir = stdout.trim();

        if (!workDir.startsWith("/")) {
          throw new Error(`${this.label} has no private directory for the AI CLIs.`);
        }

        return { workDir, emptyKubeconfig: `${workDir}/no-cluster.kubeconfig` };
      })
      .catch((error) => {
        this.dir = undefined;
        throw error;
      });

    return this.dir;
  }

  join(...parts: string[]) {
    return path.posix.join(...parts);
  }

  async writeFile(file: string, content: string) {
    // chmod as well as umask: a default ACL, as on a home directory over NFS, overrides the umask.
    await this.runOrThrow(
      'umask 077 && mkdir -p "$(dirname "$1")" && : > "$1" && chmod 600 "$1" && cat > "$1"',
      [file],
      content,
    );
  }

  async mkdir(dir: string) {
    await this.runOrThrow('umask 077 && mkdir -p "$1" && chmod 700 "$1"', [dir]);
  }

  async remove(file: string) {
    await this.runOrThrow('rm -rf -- "$1"', [file]);
  }

  async mcpUrl(localUrl: string) {
    await this.connect();

    const url = new URL(localUrl);
    const localPort = Number(url.port);
    let remotePort = this.forwarded.get(localPort);

    if (!remotePort) {
      // A port the host chooses, forwarded to Freelens's, over the shared connection.
      const attempt = this.ssh(this.args(["-O", "forward", "-R", `0:127.0.0.1:${localPort}`])).then((result) => {
        const port = Number(result.stdout.trim().split(/\s+/).pop());

        if (result.code !== 0 || !Number.isInteger(port) || port <= 0) {
          throw new Error(sshError(result.stderr) || `${this.label} did not open a port to Freelens's tools.`);
        }

        return port;
      });

      // A failed attempt, whether ssh ran or not (a timeout, no ssh command), is not kept: the next turn tries again.
      attempt.catch(() => {
        if (this.forwarded.get(localPort) === attempt) {
          this.forwarded.delete(localPort);
        }
      });
      remotePort = attempt;
      this.forwarded.set(localPort, remotePort);
    }

    url.port = String(await remotePort);

    return url.toString();
  }

  async resolveCommand(name: string, configured: string) {
    const result = await this.run(
      `if [ -n "$1" ]; then [ -x "$1" ] && printf %s "$1"; exit 0; fi
${loginShell}
exec "$s" -l -c 'command -v "$0"' "$2"`,
      [configured.trim(), name],
    );
    const found = result.stdout.trim().split(/\r?\n/).pop()?.trim();

    return result.code === 0 && found?.startsWith("/") ? found : undefined;
  }

  async spawn(command: string, args: string[], { cwd, env, readsStdin }: AiCliHostSpawnOptions): Promise<ChildProcess> {
    // The variables go in a file the command reads and removes, not on its command line, where
    // any user of the host could see a token.
    const envFile = `.freelens-env-${randomUUID()}`;
    const exports = Object.entries(env)
      .map(([name, value]) => `${name}=${shellQuote(value)}`)
      .join("\n");

    await this.writeFile(`${cwd}/${envFile}`, `${exports}\n`);

    const script = readsStdin ? runReadingStdin : runEndedByStdin;

    return this.dependencies.spawn(
      "ssh",
      this.args(["-T"], shellCommand(["/bin/sh", "-c", script, "sh", cwd, envFile, command, ...args])),
      { env: this.env(), stdio: ["pipe", "pipe", "pipe"] },
    );
  }

  close() {
    void this.ssh(this.args(["-O", "exit"])).catch(() => {});
  }
}
