/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { Logger } from "@freelensapp/logger";

import type { CrashStore } from "./crash-store";
import type { OpenLogsFolder } from "./open-logs-folder.injectable";

export interface CrashNoticeDependencies {
  store: Pick<CrashStore, "takePendingNotice">;
  showMessagePopup: (
    title: string,
    message: string,
    detail: string,
    options?: { buttons?: string[]; type?: "none" | "info" | "error" | "question" | "warning" },
  ) => Promise<{ response: number }>;
  openLogsFolder: OpenLogsFolder;
  logger: Pick<Logger, "error">;
}

/**
 * Tells the user, once, that the previous run ended badly and where its
 * crash report is. Taking the notice from the store marks its reports as
 * shown, so this can run again for later windows without repeating it.
 */
export const showCrashNoticeIfNeeded = async ({
  store,
  showMessagePopup,
  openLogsFolder,
  logger,
}: CrashNoticeDependencies): Promise<void> => {
  const notice = store.takePendingNotice();

  if (!notice) {
    return;
  }

  const newestReport = notice.reportPaths.at(-1);
  const moreReports = notice.reportPaths.length - 1;
  const message = newestReport
    ? "Freelens crashed during its previous run"
    : "Freelens did not close properly last time";
  const detail = newestReport
    ? `A crash report was saved to:\n${newestReport}${moreReports > 0 ? `\n(and ${moreReports} more in the same folder)` : ""}`
    : "The log files of the previous run may explain what happened.";

  const { response } = await showMessagePopup("Freelens", message, detail, {
    type: "warning",
    buttons: ["Open Logs Folder", "Close"],
  });

  if (response === 0) {
    await openLogsFolder().catch((error) => {
      logger.error("[CRASH-REPORTING]: failed to open logs folder", { error });
    });
  }
};
