/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { onLoadOfApplicationInjectionToken } from "@freelensapp/application";
import { loggerInjectionToken } from "@freelensapp/logger";
import { getInjectable } from "@ogre-tools/injectable";
import { execFile } from "child_process";
import crypto from "crypto";
import fsPromises from "fs/promises";
import os from "os";
import path from "path";
import directoryForBinariesInjectable from "../../common/app-paths/directory-for-binaries/directory-for-binaries.injectable";
import { ipcMainHandle } from "../../common/ipc";
import appNameInjectable from "../../common/vars/app-name.injectable";
import defaultShellInjectable from "../../common/vars/default-shell.injectable";
import isMacInjectable from "../../common/vars/is-mac.injectable";
import getClusterByIdInjectable from "../../features/cluster/storage/common/get-by-id.injectable";
import computeShellEnvironmentInjectable from "../../features/shell-sync/main/compute-shell-environment.injectable";
import userShellSettingInjectable from "../../features/user-preferences/common/shell-setting.injectable";
import { buildVersionInitializable } from "../../features/vars/build-version/common/token";
import kubeconfigManagerInjectable from "../kubeconfig-manager/kubeconfig-manager.injectable";
import createKubectlInjectable from "../kubectl/create-kubectl.injectable";
import modifyTerminalShellEnvInjectable from "./shell-env-modifier/modify-terminal-shell-env.injectable";

import type { ClusterId } from "../../common/cluster-types";

export function escapeForShellExport(s: string): string {
  // Escape single quotes for use inside single-quoted shell strings
  return s.replace(/'/g, "'\\''");
}

const openExternalTerminalInjectable = getInjectable({
  id: "open-external-terminal",

  instantiate: (di) => ({
    run: () => {
      const logger = di.inject(loggerInjectionToken);
      const getClusterById = di.inject(getClusterByIdInjectable);
      const createKubectl = di.inject(createKubectlInjectable);
      const computeShellEnvironment = di.inject(computeShellEnvironmentInjectable);
      const userShellSetting = di.inject(userShellSettingInjectable);
      const defaultShell = di.inject(defaultShellInjectable);
      const directoryForBinaries = di.inject(directoryForBinariesInjectable);
      const modifyTerminalShellEnv = di.inject(modifyTerminalShellEnvInjectable);
      const isMac = di.inject(isMacInjectable);
      const appName = di.inject(appNameInjectable);
      const buildVersion = di.inject(buildVersionInitializable.stateToken);

      ipcMainHandle("cluster:open-external-terminal", async (_event, clusterId: ClusterId, command?: string) => {
        if (!isMac) {
          logger.warn("[EXTERNAL-TERMINAL]: external terminal is only supported on macOS");
          return;
        }

        const cluster = getClusterById(clusterId);

        if (!cluster) {
          logger.error(`[EXTERNAL-TERMINAL]: cluster ${clusterId} not found`);
          return;
        }

        const kubectl = createKubectl(cluster.version.get());
        const kubeconfigManager = di.inject(kubeconfigManagerInjectable, cluster);
        const proxyKubeconfigPath = await kubeconfigManager.ensurePath();
        const directoryContainingKubectl = await kubectl.binDir();

        // Compute shell environment (same as LocalShellSession)
        const shell = userShellSetting.get() || defaultShell;
        const result = await computeShellEnvironment(shell);
        const rawEnv = result.callWasSuccessful ? (result.response ?? process.env) : process.env;
        const env: Record<string, string> = JSON.parse(JSON.stringify(rawEnv));

        env.PATH = [directoryContainingKubectl, directoryForBinaries, env.PATH].join(":");
        env.KUBECONFIG = proxyKubeconfigPath;
        env.TERM_PROGRAM = appName;
        env.TERM_PROGRAM_VERSION = buildVersion;

        if (cluster.preferences?.httpsProxy) {
          env.HTTPS_PROXY = cluster.preferences.httpsProxy;
        }

        env.NO_PROXY = ["localhost", "127.0.0.1", env.NO_PROXY].filter(Boolean).join();

        // Apply extension env modifiers
        const finalEnv = modifyTerminalShellEnv(cluster.id, env);

        // Build the export commands using single quotes (safe for paths with spaces)
        const exportLines = [
          `export KUBECONFIG='${escapeForShellExport(finalEnv.KUBECONFIG || "")}'`,
          `export PATH='${escapeForShellExport(finalEnv.PATH || "")}'`,
        ];

        if (finalEnv.HTTPS_PROXY) {
          exportLines.push(`export HTTPS_PROXY='${escapeForShellExport(finalEnv.HTTPS_PROXY)}'`);
        }

        const cwd = cluster.preferences?.terminalCWD;

        if (cwd) {
          exportLines.push(`cd '${escapeForShellExport(cwd)}'`);
        }

        // Only allow commands that start with kubectl. Shell metacharacters
        // after `--` are safe (they're arguments to the exec'd process, not
        // interpreted by the outer shell).
        if (command) {
          const isKubectl = /^(kubectl|[\w/.+-]+\/kubectl)\s/.test(command);
          const beforeDashDash = command.split(" -- ")[0] ?? "";
          const hasUnsafeChars = /[;&|`$(){}\n\r]/.test(beforeDashDash);

          if (isKubectl && !hasUnsafeChars) {
            exportLines.push(command);
          } else {
            logger.warn("[EXTERNAL-TERMINAL]: rejected unsafe command", { command });
          }
        }

        // Join with newlines for the temp script file
        const fullCmd = exportLines.join("\n");

        // Detect iTerm2 and launch
        let hasIterm = false;

        try {
          await fsPromises.access("/Applications/iTerm.app");
          hasIterm = true;
        } catch {
          // iTerm2 not installed, fall back to Terminal.app
        }

        const tmpFile = path.join(os.tmpdir(), `freelens-external-terminal-${crypto.randomUUID()}.sh`);
        const escapedTmpFile = tmpFile.replace(/'/g, "'\\''");

        // Sourced by the user's shell, not executed directly — no shebang needed.
        // The rm self-cleans the temp file after the command finishes.
        await fsPromises.writeFile(tmpFile, `${fullCmd}\nrm -f '${escapedTmpFile}'\n`, { mode: 0o600 });

        let wrappedScript: string;

        if (hasIterm) {
          wrappedScript = [
            `tell application "iTerm2"`,
            `  create window with default profile`,
            `  tell current session of current window`,
            `    write text "source '${escapedTmpFile}'"`,
            `  end tell`,
            `  activate`,
            `end tell`,
          ].join("\n");
        } else {
          wrappedScript = [
            `tell application "Terminal"`,
            `  do script "source '${escapedTmpFile}'"`,
            `  activate`,
            `end tell`,
          ].join("\n");
        }

        logger.info(`[EXTERNAL-TERMINAL]: launching ${hasIterm ? "iTerm2" : "Terminal.app"} for cluster ${clusterId}`);

        execFile("osascript", ["-e", wrappedScript], (error) => {
          if (error) {
            logger.error("[EXTERNAL-TERMINAL]: failed to launch external terminal", error);
          }
        });
      });
    },
  }),

  injectionToken: onLoadOfApplicationInjectionToken,
  causesSideEffects: true,
});

export default openExternalTerminalInjectable;
